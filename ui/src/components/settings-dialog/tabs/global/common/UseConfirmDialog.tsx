"use client";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useCallback, useRef, useState } from "react";

type ConfirmOptions = {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
};
type ConfirmState = {
    message: string;
    options: ConfirmOptions;
};

export function useConfirmDialog()
{
    const [ state, setState ] = useState<ConfirmState | null>(null);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((message: string, options: ConfirmOptions = {}) =>
    {
        setState({ message, options });
        return new Promise<boolean>((resolve) =>
        {
            resolveRef.current = resolve;
        });
    }, []);

    const handleClose = useCallback((result: boolean) =>
    {
        resolveRef.current?.(result);
        resolveRef.current = null;
        setState(null);
    }, []);

    const confirmDialog = (
        <Dialog
            aria-describedby="confirm-dialog-description"
            aria-labelledby="confirm-dialog-title"
            onClose={ () => handleClose(false) }
            open={ state !== null }
        >
            <DialogTitle id="confirm-dialog-title">
                { state?.options.title ?? "אישור פעולה" }
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="confirm-dialog-description">
                    { state?.message }
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={ () => handleClose(false) }>
                    { state?.options.cancelLabel ?? "ביטול" }
                </Button>
                <Button
                    autoFocus
                    color="error"
                    onClick={ () => handleClose(true) }
                    variant="contained"
                >
                    { state?.options.confirmLabel ?? "מחיקה" }
                </Button>
            </DialogActions>
        </Dialog>
    );

    return { confirm, confirmDialog };
}
