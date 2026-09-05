import ContentCutIcon from "@mui/icons-material/ContentCut";
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
import { useCallback, useEffect, useRef, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CutDecision, CutValidationError } from "@/api-shared/gantt/cut-planner";
import { WeekOverflowResolution } from "@/api-shared/gantt/cut-rules";
import {
    ApiCurriculumCutPayload,
    ApiCurriculumCutResponse,
    CurriculumCutError,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CutDecisionAnswer,
    CutDecisionStep,
} from "@/components/gantt/cut-dialog/CutDecisionStep";
import { CutProgressDashes } from "@/components/gantt/cut-dialog/CutProgressDashes";
import { CutSpillDetails } from "@/components/gantt/cut-dialog/CutSpillDetails";

export type CutToScheduleDialogProps = {
    open: boolean;
    curriculumId: GanttCurriculumId;
    curriculumTitle?: string;
    onClose: () => void;
    /** Fired after a successful cut so the caller can flip its cut state. */
    onSuccess?: () => void;
};

// Mirrors the real steps `cutCurriculumToSchedule` performs server-side
// (@/api-server/gantt/cut → planCut), cycled client-side since the endpoint
// is a single request with no progress feed of its own.
const LOADING_STEPS = [
    "טוען את נתוני הגאנט…",
    "בודק שיבוצים ליום…",
    "פותר אירועים מחזוריים…",
    "מאזן את העומס בין ימי השבוע…",
    "מפזר הפסקות…",
    "ממפה לימי לוח השנה…",
    "יוצר אירועים במערכת השעות…",
] as const;

type DialogPhase =
    | { kind: "confirm" }
    | { kind: "cut-error"; error: CurriculumCutError }
    | {
          kind: "decisions";
          decisions: Array<CutDecision>;
          index: number;
          plannedEvents: number;
      }
    | { kind: "generic-error"; message: string }
    | { kind: "loading" }
    | { kind: "planning" }
    | { kind: "success"; result: ApiCurriculumCutResponse };

// Only unmapped events / unsatisfied recurrences can be dropped and cut
// around — a missing start date leaves nothing datable, so it can't be forced.
function isForceableError(error: CurriculumCutError): boolean {
    return (
        error.code === "invalid-plan" &&
        (error.errors ?? []).every((e) => e.type !== "missing-start-date")
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

function CutErrorContent({ error }: { error: CurriculumCutError }) {
    switch (error.code) {
    case "no-iteration":
        return (
            <Alert severity="error">
                    לא מקושר מחזור לתוכנית לימודים זו. יש לקשר מחזור לתוכנית
                    לפני גזירה ללו&quot;ז.
            </Alert>
        );
    case "already-cut":
        return (
            <Alert severity="warning">
                    הלו&quot;ז כבר נגזר מתוכנית לימודים זו
                {typeof error.count === "number"
                    ? ` (${error.count} אירועים קיימים)`
                    : ""}
                    . כדי לגזור מחדש יש למחוק תחילה את האירועים שנוצרו.
            </Alert>
        );
    case "draft":
        return (
            <Alert severity="error">
                    הלו&quot;ז נגזר רק מתוכנית לימודים שפורסמה.
            </Alert>
        );
    case "invalid-plan":
        return (
            <Stack gap={1}>
                <Alert severity="error">
                        לא ניתן לגזור את הלו&quot;ז — נמצאו בעיות בתוכנית:
                </Alert>
                <List dense disablePadding>
                    {(error.errors ?? []).map((validationError) => (
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
            </Stack>
        );
    }
}

function CutSuccessContent({ result }: { result: ApiCurriculumCutResponse }) {
    return (
        <Stack gap={1}>
            <Alert severity="success">
                הלו&quot;ז נגזר בהצלחה! נוצרו {result.createdEvents} אירועים
                במערכת השעות.
            </Alert>
            {result.spilledEvents > 0 && (
                <CutSpillDetails
                    count={result.spilledEvents}
                    spills={result.spills}
                />
            )}
            {result.insertedBreaks > 0 && (
                <Typography variant="body2">
                    נוספו {result.insertedBreaks} הפסקות לאורך הימים.
                </Typography>
            )}
            {result.createdCourses.length > 0 && (
                <Typography variant="body2">
                    קורסים שנוצרו:{" "}
                    {result.createdCourses
                        .map((course) => course.name)
                        .join(", ")}
                </Typography>
            )}
            {result.overlaps > 0 && (
                <Alert severity="info">
                    {result.overlaps} אירועים חופפים בזמנים — יש להתאים אותם
                    ידנית בלו&quot;ז.
                </Alert>
            )}
            {/* The cut wrote real events, but a Hive hiccup left some of them
                without a subject — which the schedule renders with no colour.
                A reload repairs them, so say so instead of leaving the user to
                notice the missing colours on their own (#662). */}
            {!!result.hiveSubjectsUnavailable && (
                <Alert severity="warning">
                    לא ניתן היה לטעון את נושאי Hive בזמן הגזירה, וחלק מהאירועים
                    נוצרו ללא נושא (וללא צבע). יש להריץ &quot;עדכון הלו&quot;ז
                    לפי הגאנט&quot; לאחר שההתחברות ל-Hive תשוב לפעול.
                </Alert>
            )}
        </Stack>
    );
}

export function CutToScheduleDialog({
    open,
    curriculumId,
    curriculumTitle,
    onClose,
    onSuccess,
}: CutToScheduleDialogProps) {
    const [phase, setPhase] = useState<DialogPhase>({ kind: "confirm" });
    const [loadingStep, setLoadingStep] = useState(0);
    const [forceAcknowledged, setForceAcknowledged] = useState(false);
    // Balancing and break-spreading are on by default; unchecking either falls
    // back to raw stacking, which is how the cut behaved before #…
    const [autoSpillover, setAutoSpillover] = useState(true);
    const [insertBreaks, setInsertBreaks] = useState(true);
    const [answers, setAnswers] = useState<Array<CutDecisionAnswer>>([]);
    const loadingIntervalRef = useRef<null | ReturnType<typeof setInterval>>(null);

    // See ReloadScheduleDialog: the dialog outlives its own close, and the
    // parent can flip `open` without going through `handleClose`, so an
    // "already-cut" error would otherwise reappear after a pull-back.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setPhase({ kind: "confirm" });
            setForceAcknowledged(false);
            setLoadingStep(0);
            setAutoSpillover(true);
            setInsertBreaks(true);
            setAnswers([]);
        }
    }

    useEffect(() => {
        if (phase.kind === "loading" || phase.kind === "planning") {
            loadingIntervalRef.current = setInterval(() => {
                setLoadingStep((step) =>
                    Math.min(step + 1, LOADING_STEPS.length - 1),
                );
            }, 900);
        } else if (loadingIntervalRef.current) {
            clearInterval(loadingIntervalRef.current);
            loadingIntervalRef.current = null;
        }
        return () => {
            if (loadingIntervalRef.current) {
                clearInterval(loadingIntervalRef.current);
                loadingIntervalRef.current = null;
            }
        };
    }, [phase.kind]);

    const handleClose = useCallback(() => {
        if (phase.kind === "loading" || phase.kind === "planning") return;
        onClose();
        setPhase({ kind: "confirm" });
        setForceAcknowledged(false);
        setAnswers([]);
    }, [onClose, phase.kind]);

    /** The options a plan/commit request carries, including answered decisions. */
    const payloadFor = useCallback(
        (force: boolean, collected: Array<CutDecisionAnswer>): ApiCurriculumCutPayload => ({
            force,
            autoSpillover,
            insertBreaks,
            acceptedConstraintMoves: collected.flatMap((answer) =>
                answer.type === "constraint-moves" ? answer.acceptedEventIds : [],
            ),
            weekOverflowResolutions: Object.fromEntries(
                collected
                    .filter(
                        (answer): answer is Extract<
                            CutDecisionAnswer,
                            { type: "week-overflow" }
                        > => answer.type === "week-overflow",
                    )
                    .map((answer) => [answer.weekId, answer.resolution]),
            ) as Record<string, WeekOverflowResolution>,
        }),
        [autoSpillover, insertBreaks],
    );

    /** Commit half of plan-then-confirm: writes, carrying the user's answers. */
    const commit = useCallback(
        async (force: boolean, collected: Array<CutDecisionAnswer>) => {
            setLoadingStep(0);
            setPhase({ kind: "loading" });
            try {
                const result = await ganttApi.cut.cut(
                    curriculumId,
                    payloadFor(force, collected),
                );
                setPhase({ kind: "success", result });
                onSuccess?.();
            } catch (error) {
                if (error instanceof CurriculumCutError) {
                    setPhase({ kind: "cut-error", error });
                } else {
                    setPhase({
                        kind: "generic-error",
                        message: 'גזירת הלו"ז נכשלה. נסו שוב מאוחר יותר.',
                    });
                }
            }
        },
        [curriculumId, onSuccess, payloadFor],
    );

    /**
     * Plan half of plan-then-confirm: nothing is written. When the plan raises
     * questions the dialog walks them one at a time; when it raises none it
     * goes straight to the commit, so the common case is still one click.
     */
    const handleConfirm = useCallback(
        async (force = false) => {
            setLoadingStep(0);
            setPhase({ kind: "planning" });
            try {
                const plan = await ganttApi.cut.plan(
                    curriculumId,
                    payloadFor(force, []),
                );
                if (!plan.ok) {
                    setPhase({
                        kind: "cut-error",
                        error: new CurriculumCutError({
                            code: "invalid-plan",
                            errors: plan.errors,
                            message: "תוכנית הגזירה אינה תקינה",
                        }),
                    });
                    return;
                }
                if (plan.report.decisions.length === 0) {
                    await commit(force, []);
                    return;
                }
                setAnswers([]);
                setPhase({
                    kind: "decisions",
                    decisions: plan.report.decisions,
                    index: 0,
                    plannedEvents: plan.plannedEvents,
                });
            } catch (error) {
                if (error instanceof CurriculumCutError) {
                    setPhase({ kind: "cut-error", error });
                } else {
                    setPhase({
                        kind: "generic-error",
                        message: 'גזירת הלו"ז נכשלה. נסו שוב מאוחר יותר.',
                    });
                }
            }
        },
        [commit, curriculumId, payloadFor],
    );

    /** Record the current question's answer and advance, or commit when done. */
    const handleDecisionNext = useCallback(() => {
        if (phase.kind !== "decisions") return;
        const isLast = phase.index === phase.decisions.length - 1;
        if (isLast) {
            void commit(forceAcknowledged, answers);
            return;
        }
        setPhase({ ...phase, index: phase.index + 1 });
    }, [answers, commit, forceAcknowledged, phase]);

    /** Step back to the previous question, keeping its already-recorded answer. */
    const handleDecisionBack = useCallback(() => {
        if (phase.kind !== "decisions" || phase.index === 0) return;
        setPhase({ ...phase, index: phase.index - 1 });
    }, [phase]);

    const answerFor = useCallback(
        (decision: CutDecision): CutDecisionAnswer | undefined =>
            answers.find((answer) => {
                if (decision.type === "week-overflow") {
                    return (
                        answer.type === "week-overflow" &&
                        answer.weekId === decision.weekId
                    );
                }
                return answer.type === decision.type;
            }),
        [answers],
    );

    const recordAnswer = useCallback((answer: CutDecisionAnswer) => {
        setAnswers((previous) => [
            ...previous.filter((existing) =>
                answer.type === "week-overflow" && existing.type === "week-overflow"
                    ? existing.weekId !== answer.weekId
                    : existing.type !== answer.type,
            ),
            answer,
        ]);
    }, []);

    const isTerminal =
        phase.kind === "success" ||
        phase.kind === "cut-error" ||
        phase.kind === "generic-error";

    return (
        <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={open}>
            <DialogTitle>
                גזירה ללו&quot;ז
                {curriculumTitle ? ` — ${curriculumTitle}` : ""}
            </DialogTitle>
            <DialogContent>
                {phase.kind === "confirm" && (
                    <Stack gap={1}>
                        <DialogContentText>
                            פעולה זו תיצור אירוע במערכת השעות של המחזור המקושר
                            עבור כל מופע מתוכנן בגאנט. הפעולה חד־פעמית — גזירה
                            חוזרת מחייבת מחיקת האירועים שנוצרו. להמשיך?
                        </DialogContentText>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={autoSpillover}
                                    onChange={(e) =>
                                        setAutoSpillover(e.target.checked)
                                    }
                                />
                            }
                            label="איזון אוטומטי של השבוע — לגלוש אירועים שלא נכנסים ליום לימים פנויים באותו שבוע"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={insertBreaks}
                                    onChange={(e) =>
                                        setInsertBreaks(e.target.checked)
                                    }
                                />
                            }
                            label="פיזור הפסקות — לפזר את הזמן הפנוי כהפסקות לאורך היום במקום להשאירו בסופו"
                        />
                    </Stack>
                )}
                {phase.kind === "planning" && (
                    <Stack alignItems="center" gap={1} sx={{ py: 2 }}>
                        <CircularProgress />
                        <Typography variant="body2">
                            מתכנן את הגזירה…
                        </Typography>
                    </Stack>
                )}
                {phase.kind === "decisions" && (
                    <Stack gap={1.5}>
                        <CutProgressDashes
                            current={phase.index}
                            total={phase.decisions.length}
                        />
                        <Typography color="text.secondary" variant="caption">
                            {phase.plannedEvents} אירועים מתוכננים
                        </Typography>
                        <CutDecisionStep
                            answer={answerFor(phase.decisions[phase.index])}
                            decision={phase.decisions[phase.index]}
                            onAnswer={recordAnswer}
                        />
                    </Stack>
                )}
                {phase.kind === "loading" && (
                    <Stack alignItems="center" gap={1} sx={{ py: 2 }}>
                        <CircularProgress />
                        <Typography variant="body2">
                            {LOADING_STEPS[loadingStep]}
                        </Typography>
                    </Stack>
                )}
                {phase.kind === "success" && (
                    <CutSuccessContent result={phase.result} />
                )}
                {phase.kind === "cut-error" && (
                    <>
                        <CutErrorContent error={phase.error} />
                        {isForceableError(phase.error) && (
                            <Stack gap={1} sx={{ mt: 1 }}>
                                <Alert severity="error">
                                    <strong>
                                        אזהרה — הגאנט אינו שלם.
                                    </strong>{" "}
                                    ייתכן שסילבוסים או מודולים שלמים אינם
                                    משובצים לימים. גזירה בשלב הזה{" "}
                                    <strong>תדלג לחלוטין</strong> על כל
                                    אירוע לא משובץ — הוא לא ייכנס למערכת
                                    השעות, בלי התראה נוספת מעבר לזו. פעולה זו
                                    אינה מומלצת. השלימו את השיבוץ בגאנט לפני
                                    גזירה, אלא אם כן אתם בטוחים שזה מכוון.
                                </Alert>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={forceAcknowledged}
                                            onChange={(e) =>
                                                setForceAcknowledged(e.target.checked)
                                            }
                                        />
                                    }
                                    label="הבנתי את הסיכון, וברצוני לגזור בכל זאת תוך דילוג על האירועים הלא-משובצים."
                                />
                            </Stack>
                        )}
                    </>
                )}
                {phase.kind === "generic-error" && (
                    <Alert severity="error">{phase.message}</Alert>
                )}
            </DialogContent>
            <DialogActions>
                {phase.kind === "confirm" && (
                    <>
                        <Button onClick={handleClose}>ביטול</Button>
                        <Button
                            color="primary"
                            onClick={() => handleConfirm()}
                            startIcon={<ContentCutIcon fontSize="small" />}
                            variant="contained"
                        >
                            גזירה
                        </Button>
                    </>
                )}
                {phase.kind === "decisions" && (
                    <>
                        <Button onClick={handleClose}>ביטול</Button>
                        {phase.index > 0 && (
                            <Button onClick={handleDecisionBack}>חזרה</Button>
                        )}
                        <Button
                            color="primary"
                            onClick={handleDecisionNext}
                            startIcon={
                                phase.index === phase.decisions.length - 1 ? (
                                    <ContentCutIcon fontSize="small" />
                                ) : undefined
                            }
                            variant="contained"
                        >
                            {phase.index === phase.decisions.length - 1
                                ? "גזירה"
                                : "הבא"}
                        </Button>
                    </>
                )}
                {phase.kind === "cut-error" && isForceableError(phase.error) && (
                    <Button
                        color="warning"
                        disabled={!forceAcknowledged}
                        onClick={() => handleConfirm(true)}
                        startIcon={<ContentCutIcon fontSize="small" />}
                        variant="contained"
                    >
                        גזירה בכל זאת
                    </Button>
                )}
                {isTerminal ? <Button onClick={handleClose} variant="contained">
                        סגירה
                </Button> : null}
            </DialogActions>
        </Dialog>
    );
}
