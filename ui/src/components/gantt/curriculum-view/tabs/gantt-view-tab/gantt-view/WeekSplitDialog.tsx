import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import React, { useState } from "react";

import { isWeekSplitComplete } from "@/api-shared/gantt/week-split";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";

/** Hours typed in a part field → whole minutes (NaN for blank/garbage). */
export function hoursToMinutes(hours: string): number {
    const value = Number(hours);
    return hours.trim() === "" || !Number.isFinite(value)
        ? Number.NaN
        : Math.round(value * 60);
}

/** The starting parts: the stored split, else the whole duration in two halves. */
export function initialWeekSplitHours(
    parts: Array<number> | undefined,
    totalMinutes: number,
): Array<string> {
    if (parts && parts.length >= 2) return parts.map((part) => String(part / 60));
    const first = Math.ceil(totalMinutes / 2);
    return [ String(first / 60), String((totalMinutes - first) / 60) ];
}

/**
 * Edits how an event's hours spread over consecutive weeks (#768): one field
 * per week, starting at the mapped week. Saving needs the parts to add up to
 * the event's whole duration; clearing runs it whole again.
 */
export const WeekSplitDialog: React.FC<{
    eventTitle: string;
    initialParts: Array<number> | undefined;
    onClose: () => void;
    onSave: (parts: Array<number>) => void;
    open: boolean;
    totalMinutes: number;
}> = ({ eventTitle, initialParts, onClose, onSave, open, totalMinutes }) =>
{
    const [ hours, setHours ] = useState(() =>
        initialWeekSplitHours(initialParts, totalMinutes),
    );
    const parts = hours.map(hoursToMinutes);
    const valid =
        parts.every((part) => Number.isInteger(part) && part > 0) &&
        isWeekSplitComplete(parts, totalMinutes);
    const assigned = parts.reduce(
        (sum, part) => sum + (Number.isFinite(part) ? part : 0),
        0,
    );

    return (
        <Dialog fullWidth maxWidth="xs" onClose={ onClose } open={ open }>
            <DialogTitle>{ `פיצול בין שבועות — ${eventTitle}` }</DialogTitle>
            <DialogContent>
                <Stack gap={ 1.5 } sx={ { pt: 1 } }>
                    { hours.map((value, index) => (
                        <Stack alignItems="center" direction="row" gap={ 1 } key={ index }>
                            <TextField
                                fullWidth
                                label={ `שבוע ${index + 1} (שעות)` }
                                onChange={ (e) =>
                                    setHours((prev) =>
                                        prev.map((h, i) => (i === index ? e.target.value : h)),
                                    )
                                }
                                size="small"
                                slotProps={ { htmlInput: { inputMode: "decimal", min: 0, step: 0.5 } } }
                                type="number"
                                value={ value }
                            />
                            <IconButton
                                aria-label={ `הסרת שבוע ${index + 1}` }
                                disabled={ hours.length <= 2 }
                                onClick={ () =>
                                    setHours((prev) => prev.filter((_, i) => i !== index))
                                }
                                size="small"
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    )) }
                    <Button
                        onClick={ () => setHours((prev) => [ ...prev, "" ]) }
                        size="small"
                        startIcon={ <AddIcon fontSize="small" /> }
                        sx={ { alignSelf: "flex-start" } }
                    >
                        הוספת שבוע
                    </Button>
                    <Typography
                        color={ valid ? "text.secondary" : "error" }
                        data-testid="week-split-total"
                        variant="body2"
                    >
                        { `שובצו ${formatHoursLabel(assigned)} מתוך ${formatHoursLabel(totalMinutes)}` }
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button color="error" onClick={ () => onSave([]) }>
                    ביטול הפיצול
                </Button>
                <Button onClick={ onClose }>סגירה</Button>
                <Button disabled={ !valid } onClick={ () => onSave(parts) } variant="contained">
                    שמירה
                </Button>
            </DialogActions>
        </Dialog>
    );
};
