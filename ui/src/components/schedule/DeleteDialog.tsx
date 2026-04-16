'use client';

import
  {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
  } from '@mui/material';

import { Event } from "@/components/schedule/types/event";

interface DeleteDialogProps
{
  open: boolean;
  event?: null | Partial<Event>;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDialog({
  open,
  event,
  onClose,
  onConfirm,
}: DeleteDialogProps)
{
  if (!event) return null;

  return (
    <Dialog
      onClose={ onClose }
      open={ open }
    >
      <DialogTitle>אשר מחיקה</DialogTitle>
      <DialogContent>
        <Typography>
          האם אתה בטוח שברצונך למחוק את &quot;{ event.name }&quot; מ{ }?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={ onClose }>
          ביטול
        </Button>
        <Button
          color="error"
          onClick={ onConfirm }
          variant="contained"
        >
          מחק
        </Button>
      </DialogActions>
    </Dialog>
  );
}
