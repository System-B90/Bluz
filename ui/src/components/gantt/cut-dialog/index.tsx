import ContentCutIcon from "@mui/icons-material/ContentCut";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CutValidationError } from "@/api-shared/gantt/cut-planner";
import {
    ApiCurriculumCutResponse,
    CurriculumCutError,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

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
    "ממפה לימי לוח השנה…",
    "יוצר אירועים במערכת השעות…",
] as const;

type DialogPhase =
    | { kind: "confirm" }
    | { kind: "cut-error"; error: CurriculumCutError }
    | { kind: "generic-error"; message: string }
    | { kind: "loading" }
    | { kind: "success"; result: ApiCurriculumCutResponse };

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
                    {(error.errors ?? []).map((validationError, index) => (
                        <ListItem disableGutters key={index}>
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
    const loadingIntervalRef = useRef<null | ReturnType<typeof setInterval>>(null);

    useEffect(() => {
        if (phase.kind === "loading") {
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
        if (phase.kind === "loading") return;
        onClose();
        setPhase({ kind: "confirm" });
    }, [onClose, phase.kind]);

    const handleConfirm = useCallback(async () => {
        setLoadingStep(0);
        setPhase({ kind: "loading" });
        try {
            const result = await ganttApi.cut.cut(curriculumId);
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
    }, [curriculumId, onSuccess]);

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
                    <DialogContentText>
                        פעולה זו תיצור אירוע במערכת השעות של המחזור המקושר עבור
                        כל מופע מתוכנן בגאנט. הפעולה חד־פעמית — גזירה חוזרת
                        מחייבת מחיקת האירועים שנוצרו. להמשיך?
                    </DialogContentText>
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
                    <CutErrorContent error={phase.error} />
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
                            onClick={handleConfirm}
                            startIcon={<ContentCutIcon fontSize="small" />}
                            variant="contained"
                        >
                            גזירה
                        </Button>
                    </>
                )}
                {isTerminal ? <Button onClick={handleClose} variant="contained">
                        סגירה
                </Button> : null}
            </DialogActions>
        </Dialog>
    );
}
