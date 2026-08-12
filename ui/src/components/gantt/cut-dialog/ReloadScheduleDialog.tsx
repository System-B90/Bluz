import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    eventFieldLabel,
    INITIATOR_LABELS,
} from "@/api-shared/event-history";
import { CutValidationError } from "@/api-shared/gantt/cut-planner";
import {
    EventChangeInitiator,
    EventFieldChange,
} from "@/api-shared/types/event-history";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    ApiCurriculumReloadResponse,
    CurriculumReloadError,
    ReloadConflict,
} from "@/api-shared/types/gantt/reload";

/**
 * "עדכון הלו״ז לפי הגאנט" — reconciles an already-cut schedule with the
 * current gantt. Non-conflicting changes are applied immediately; events a
 * person edited after the cut are listed here so the user can decide, per
 * event, whether the gantt version should win after all.
 */

export type ReloadScheduleDialogProps = {
    open: boolean;
    curriculumId: GanttCurriculumId;
    curriculumTitle?: string;
    onClose: () => void;
    /** Fired after any successful apply so the caller can refresh its view. */
    onSuccess?: () => void;
};

type DialogPhase =
    | { kind: "confirm" }
    | { kind: "error"; message: string }
    | { kind: "incomplete-gantt"; errors: Array<CutValidationError> }
    | { kind: "loading" }
    | { kind: "result"; result: ApiCurriculumReloadResponse };

/**
 * An unfinished gantt (unmapped events / unsatisfied recurrences) is the one
 * rejection the user can knowingly push past, exactly as the cut allows: the
 * offending events are skipped instead of blocking the update. Anything else —
 * a missing start date, a draft, no linked iteration — cannot be forced.
 */
function isForceableError(error: CurriculumReloadError): boolean {
    return (
        error.code === "invalid-plan" &&
        (error.errors ?? []).length > 0 &&
        (error.errors ?? []).every(
            (validationError) => validationError.type !== "missing-start-date",
        )
    );
}

function describeValidationError(error: CutValidationError): string {
    switch (error.type) {
    case "missing-start-date":
        return "לתוכנית הלימודים אין תאריך התחלה";
    case "unmapped-event":
        return `האירוע "${error.title}" אינו משובץ ליום כלשהו`;
    case "unsatisfied-recurrence":
        return `לאירוע המחזורי "${error.title}" אין שיבוץ פתיחה בשבוע הראשון`;
    }
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.length === 0 ? "—" : `${value.length} פריטים`;
    if (typeof value === "number" && value > 1_000_000_000_000) {
        return new Date(value).toLocaleString("he-IL");
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value as boolean | number | string);
}

function describeChange(change: EventFieldChange): string {
    return `${eventFieldLabel(change.field)}: ${formatValue(change.from)} ← ${formatValue(change.to)}`;
}

function describeConflictSource(conflict: ReloadConflict): string {
    const edit = conflict.lastManualEdit;
    if (!edit) return "נערך ידנית לאחר הגזירה";
    const label =
        INITIATOR_LABELS[edit.initiator as EventChangeInitiator] ??
        edit.initiator;
    const when = new Date(edit.changedAt).toLocaleString("he-IL");
    return `${label} · ${edit.actorName ?? "משתמש לא ידוע"} · ${when}`;
}

function ResultSummary({ result }: { result: ApiCurriculumReloadResponse }) {
    const { addedEvents, diff, removedEvents, updatedEvents } = result;
    const nothingChanged =
        addedEvents === 0 &&
        updatedEvents === 0 &&
        removedEvents === 0 &&
        diff.conflicts.length === 0;

    if (nothingChanged) {
        return (
            <Alert severity="info">
                הלו&quot;ז כבר תואם לגאנט — לא בוצע שינוי.
            </Alert>
        );
    }

    return (
        <Alert severity="success">
            הלו&quot;ז עודכן: {addedEvents} מופעים נוספו, {updatedEvents} עודכנו,{" "}
            {removedEvents} הוסרו.
        </Alert>
    );
}

export function ReloadScheduleDialog({
    open,
    curriculumId,
    curriculumTitle,
    onClose,
    onSuccess,
}: ReloadScheduleDialogProps) {
    const [phase, setPhase] = useState<DialogPhase>({ kind: "confirm" });
    const [overrideIds, setOverrideIds] = useState<Array<string>>([]);
    const [forceAcknowledged, setForceAcknowledged] = useState(false);

    // Reset while rendering the open transition, not in an effect (React's
    // "adjusting state when a prop changes" pattern). The dialog stays mounted
    // while closed so its exit animation can play, and it is not always closed
    // through `handleClose` — the parent can simply flip `open` to switch
    // actions. Without this, the phase from an earlier attempt (an error, a
    // finished summary) is what greets the user on the next open, most
    // visibly after a pull-back and re-cut where it is plainly stale.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setPhase({ kind: "confirm" });
            setOverrideIds([]);
            setForceAcknowledged(false);
        }
    }

    const handleClose = useCallback(() => {
        if (phase.kind === "loading") return;
        onClose();
        setPhase({ kind: "confirm" });
        setOverrideIds([]);
        setForceAcknowledged(false);
    }, [onClose, phase.kind]);

    const runReload = useCallback(
        async (eventIdsToOverride: Array<string>, force = false) => {
            setPhase({ kind: "loading" });
            try {
                const result = await ganttApi.cut.reload(curriculumId, {
                    force,
                    overrideEventIds: eventIdsToOverride,
                });
                setPhase({ kind: "result", result });
                setOverrideIds([]);
                onSuccess?.();
            } catch (error) {
                if (
                    error instanceof CurriculumReloadError &&
                    isForceableError(error)
                ) {
                    setPhase({
                        errors: error.errors ?? [],
                        kind: "incomplete-gantt",
                    });
                    return;
                }
                setPhase({
                    kind: "error",
                    message:
                        error instanceof CurriculumReloadError
                            ? error.message
                            : 'עדכון הלו"ז נכשל. נסו שוב מאוחר יותר.',
                });
            }
        },
        [curriculumId, onSuccess],
    );

    const toggleOverride = useCallback((eventId: string) => {
        setOverrideIds((current) =>
            current.includes(eventId)
                ? current.filter((id) => id !== eventId)
                : [...current, eventId],
        );
    }, []);

    const conflicts =
        phase.kind === "result" ? phase.result.diff.conflicts : [];

    return (
        <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={open}>
            <DialogTitle>
                עדכון הלו&quot;ז לפי הגאנט
                {curriculumTitle ? ` — ${curriculumTitle}` : ""}
            </DialogTitle>
            <DialogContent>
                {phase.kind === "confirm" && (
                    <DialogContentText>
                        פעולה זו תשווה את הגאנט הנוכחי ללו&quot;ז שנגזר ממנו:
                        מופעים חדשים יתווספו, מופעים שהשתנו יעודכנו ומופעים
                        שהוסרו מהגאנט יימחקו. אירועים שנערכו ידנית לאחר הגזירה
                        לא ישונו — הם יוצגו לאישור נפרד. להמשיך?
                    </DialogContentText>
                )}
                {phase.kind === "loading" && (
                    <Stack alignItems="center" gap={1} sx={{ py: 2 }}>
                        <CircularProgress />
                        <Typography variant="body2">
                            משווה את הגאנט ללו&quot;ז ומעדכן…
                        </Typography>
                    </Stack>
                )}
                {phase.kind === "result" && (
                    <Stack gap={1}>
                        <ResultSummary result={phase.result} />
                        {conflicts.length > 0 && (
                            <>
                                <Alert severity="warning">
                                    {conflicts.length} אירועים נערכו ידנית לאחר
                                    הגזירה ולכן לא עודכנו. סמנו את מי שברצונכם
                                    לדרוס בגרסת הגאנט.
                                </Alert>
                                <List dense disablePadding>
                                    {conflicts.map((conflict) => (
                                        <ListItem
                                            disableGutters
                                            key={conflict.eventId}
                                            secondaryAction={
                                                <Checkbox
                                                    checked={overrideIds.includes(
                                                        conflict.eventId,
                                                    )}
                                                    onChange={() =>
                                                        toggleOverride(
                                                            conflict.eventId,
                                                        )
                                                    }
                                                />
                                            }
                                        >
                                            <ListItemText
                                                primary={`${conflict.title} — ${conflict.occurrenceDate}${
                                                    conflict.kind === "removal"
                                                        ? " (הגאנט מבקש למחוק)"
                                                        : ""
                                                }`}
                                                secondary={[
                                                    describeConflictSource(
                                                        conflict,
                                                    ),
                                                    ...conflict.changes.map(
                                                        describeChange,
                                                    ),
                                                ].join(" · ")}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </>
                        )}
                    </Stack>
                )}
                {phase.kind === "incomplete-gantt" && (
                    <Stack gap={1}>
                        <Alert severity="error">
                            <strong>אזהרה — הגאנט אינו שלם.</strong> העדכון{" "}
                            <strong>ידלג לחלוטין</strong> על כל אירוע שאינו
                            משובץ ליום — הוא לא ייכנס למערכת השעות, ואם כבר
                            נגזר בעבר הוא יוסר ממנה. השלימו את השיבוץ בגאנט
                            לפני העדכון, אלא אם כן זה מכוון.
                        </Alert>
                        <List dense disablePadding>
                            {phase.errors.map((validationError) => (
                                <ListItem
                                    disableGutters
                                    key={
                                        "eventId" in validationError
                                            ? `${validationError.type}:${validationError.eventId}`
                                            : validationError.type
                                    }
                                >
                                    <ListItemText
                                        primary={describeValidationError(
                                            validationError,
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={forceAcknowledged}
                                    onChange={(event) =>
                                        setForceAcknowledged(
                                            event.target.checked,
                                        )
                                    }
                                />
                            }
                            label="הבנתי את הסיכון, וברצוני לעדכן בכל זאת תוך דילוג על האירועים הלא-משובצים."
                        />
                    </Stack>
                )}
                {phase.kind === "error" && (
                    <Alert severity="error">{phase.message}</Alert>
                )}
            </DialogContent>
            <DialogActions>
                {phase.kind === "confirm" && (
                    <>
                        <Button onClick={handleClose}>ביטול</Button>
                        <Button
                            color="primary"
                            onClick={() => runReload([])}
                            startIcon={<SyncIcon fontSize="small" />}
                            variant="contained"
                        >
                            עדכון
                        </Button>
                    </>
                )}
                {phase.kind === "result" && conflicts.length > 0 && (
                    <Button
                        color="warning"
                        disabled={overrideIds.length === 0}
                        onClick={() => runReload(overrideIds)}
                        startIcon={<SyncIcon fontSize="small" />}
                        variant="contained"
                    >
                        דריסת {overrideIds.length} אירועים בגרסת הגאנט
                    </Button>
                )}
                {phase.kind === "incomplete-gantt" && (
                    <>
                        <Button onClick={handleClose}>ביטול</Button>
                        <Button
                            color="warning"
                            disabled={!forceAcknowledged}
                            onClick={() => runReload(overrideIds, true)}
                            startIcon={<SyncIcon fontSize="small" />}
                            variant="contained"
                        >
                            עדכון בכל זאת
                        </Button>
                    </>
                )}
                {(phase.kind === "result" || phase.kind === "error") && (
                    <Button onClick={handleClose} variant="contained">
                        סגירה
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
