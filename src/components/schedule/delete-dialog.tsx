'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { Period } from './types';

interface DeleteDialogProps {
  open: boolean;
  period: Period | null;
  dayName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteDialog({
  open,
  period,
  dayName,
  onClose,
  onConfirm,
}: DeleteDialogProps) {
  if (!period) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>אשר מחיקה</DialogTitle>
      <DialogContent>
        <Typography>
          האם אתה בטוח שברצונך למחוק את &quot;{period.name}&quot; מ{dayName}?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          ביטול
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
        >
          מחק
        </Button>
      </DialogActions>
    </Dialog>
  );
}
