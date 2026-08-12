import UndoIcon from "@mui/icons-material/Undo";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    ApiCurriculumPullBackResponse,
    CurriculumPullBackError,
} from "@/api-shared/types/gantt/cut";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type PullBackScheduleDialogProps = {
    open: boolean;
    curriculumId: GanttCurriculumId;
    curriculumTitle?: string;
    onClose: () => void;
    /** Fired after a successful pull-back so the caller can flip its cut state. */
    onSuccess?: () => void;
};

type DialogPhase =
    | { kind: "confirm" }
    | { kind: "error"; message: string }
    | { kind: "loading" }
    | { kind: "success"; result: ApiCurriculumPullBackResponse };

export function PullBackScheduleDialog({
    open,
    curriculumId,
    curriculumTitle,
    onClose,
    onSuccess,
}: PullBackScheduleDialogProps) {
    const [phase, setPhase] = useState<DialogPhase>({ kind: "confirm" });

    // See ReloadScheduleDialog: reset on the open transition so a previous
    // result/error cannot resurface on the next pull-back.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setPhase({ kind: "confirm" });
    }

    const handleClose = useCallback(() => {
        if (phase.kind === "loading") return;
        onClose();
        setPhase({ kind: "confirm" });
    }, [onClose, phase.kind]);

    const handleConfirm = useCallback(async () => {
        setPhase({ kind: "loading" });
        try {
            const result = await ganttApi.cut.pullBack(curriculumId);
            setPhase({ kind: "success", result });
            onSuccess?.();
        } catch (error) {
            const message =
                error instanceof CurriculumPullBackError
                    ? error.message
                    : 'משיכת הלו"ז חזרה נכשלה. נסו שוב מאוחר יותר.';
            setPhase({ kind: "error", message });
        }
    }, [curriculumId, onSuccess]);

    const isTerminal = phase.kind === "success" || phase.kind === "error";

    return (
        <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={open}>
            <DialogTitle>
                משיכת הלו&quot;ז חזרה
                {curriculumTitle ? ` — ${curriculumTitle}` : ""}
            </DialogTitle>
            <DialogContent>
                {phase.kind === "confirm" && (
                    <DialogContentText>
                        פעולה זו תמחק את כל אירועי מערכת השעות שנוצרו בגזירה של
                        גאנט זה. ניתן לגזור מחדש לאחר מכן. האם להמשיך?
                    </DialogContentText>
                )}
                {phase.kind === "loading" && (
                    <Stack alignItems="center" gap={1} sx={{ py: 2 }}>
                        <CircularProgress />
                        <Typography variant="body2">
                            מוחק את האירועים שנגזרו…
                        </Typography>
                    </Stack>
                )}
                {phase.kind === "success" && (
                    <Alert severity="success">
                        {phase.result.removedEvents} אירועים נמחקו ממערכת השעות.
                        ניתן כעת לגזור מחדש.
                    </Alert>
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
                            color="warning"
                            onClick={handleConfirm}
                            startIcon={<UndoIcon fontSize="small" />}
                            variant="contained"
                        >
                            משיכה חזרה
                        </Button>
                    </>
                )}
                {isTerminal ? (
                    <Button onClick={handleClose} variant="contained">
                        סגירה
                    </Button>
                ) : null}
            </DialogActions>
        </Dialog>
    );
}
