import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import {
    ShuffleUsageItem,
    ShuffleUsages,
} from "@/api-shared/types/gantt/shuffles";

export type ShuffleDeleteDialogProps = {
    open: boolean;
    /** Shuffle names about to be deleted from the syllabus. */
    removed: Array<string>;
    /** Modules and events currently tagged with those names. */
    usages: ShuffleUsages;
    onCancel: () => void;
    onConfirm: () => void;
};

function UsageList({
    items,
    title,
}: {
    items: Array<ShuffleUsageItem>;
    title: string;
}) {
    if (items.length === 0) return null;

    return (
        <Stack gap={0.5}>
            <Typography variant="subtitle2">{title}</Typography>
            <List dense disablePadding>
                {items.map((item) => (
                    <ListItem disableGutters key={item.id}>
                        <ListItemText
                            primary={item.title}
                            secondary={item.shuffles.join(", ")}
                        />
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
}

/**
 * Confirms deleting shuffle names that modules or events still use, listing
 * every item the deletion would strip them from (#485).
 */
export function ShuffleDeleteDialog({
    open,
    removed,
    usages,
    onCancel,
    onConfirm,
}: ShuffleDeleteDialogProps) {
    const [acknowledged, setAcknowledged] = useState(false);

    // The dialog outlives its own close, so reset the acknowledgement whenever
    // it reopens for a different set of names.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setAcknowledged(false);
    }

    const quoted = removed.map((name) => `"${name}"`).join(", ");

    return (
        <Dialog fullWidth maxWidth="sm" onClose={onCancel} open={open}>
            <DialogTitle>מחיקת שאפל</DialogTitle>
            <DialogContent>
                <Stack gap={1.5}>
                    <Alert severity="warning">
                        השאפלים {quoted} בשימוש בפריטים הבאים. מחיקתם תסיר אותם
                        גם מהפריטים האלה.
                    </Alert>
                    <UsageList items={usages.modules} title="מודולים" />
                    <UsageList items={usages.events} title="אירועים" />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={acknowledged}
                                onChange={(e) =>
                                    setAcknowledged(e.target.checked)
                                }
                            />
                        }
                        label="הבנתי, יש להסיר את השאפלים גם מהפריטים המפורטים."
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>ביטול</Button>
                <Button
                    color="error"
                    disabled={!acknowledged}
                    onClick={onConfirm}
                    startIcon={<DeleteOutlineIcon fontSize="small" />}
                    variant="contained"
                >
                    מחיקת שאפל
                </Button>
            </DialogActions>
        </Dialog>
    );
}
