"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useEffect, useState } from "react";

import { apiListIterations } from "@/api-client/iterations";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

/**
 * A fresh install no longer inherits an auto-created "current" iteration
 * (#471) — that iteration had no real name, and its literal id collided with
 * the `/api/iterations/current` route. Instead the app asks for a real one on
 * first boot and points at the tab that creates it.
 *
 * Re-checked whenever the settings dialog closes, so creating the iteration
 * dismisses the prompt without a reload. A failed list leaves the prompt shut:
 * an unreachable registry is an outage, not an empty install.
 */
export function NoIterationPrompt() {
    const { isOpen, openDialog } = useSettingsDialogUrl();
    const [needsIteration, setNeedsIteration] = useState(false);

    useEffect(() => {
        if (isOpen) return;
        let mounted = true;
        apiListIterations()
            .then((list) => {
                if (mounted) setNeedsIteration(list.length === 0);
            })
            .catch(() => {
                if (mounted) setNeedsIteration(false);
            });
        return () => {
            mounted = false;
        };
    }, [isOpen]);

    return (
        <Dialog open={Boolean(needsIteration && !isOpen)}>
            <DialogTitle>לא הוגדר מחזור</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    כדי להתחיל לעבוד יש ליצור מחזור עם מזהה ושם אמיתיים. כל
                    מחזור מקבל מסד נתונים משלו.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button
                    autoFocus
                    onClick={() => openDialog("iterations")}
                    variant="contained"
                >
                    יצירת מחזור
                </Button>
            </DialogActions>
        </Dialog>
    );
}
