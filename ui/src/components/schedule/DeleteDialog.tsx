"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

import { Event } from "@/components/schedule/types/event";

type DeleteDialogProps = {
  open: boolean;
  event?: null | Partial<Event>;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteDialog({
    open,
    event,
    onClose,
    onConfirm,
}: DeleteDialogProps) {
    if (!event) return null;

    return (
        <Dialog onClose={onClose} open={open}>
            <DialogTitle>אשר מחיקה</DialogTitle>
            <DialogContent>
                <Typography>
          האם אתה בטוח שברצונך למחוק את &quot;{event.name}&quot; מ{}?
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>ביטול</Button>
                <Button color="error" onClick={onConfirm} variant="contained">
          מחק
                </Button>
            </DialogActions>
        </Dialog>
    );
}
