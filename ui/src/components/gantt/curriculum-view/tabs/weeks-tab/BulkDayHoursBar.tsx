"use client";

import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { KeyboardEvent, useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import {
    formatMinutesAsTimeInput,
    parseTimeInputToMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useDaySelection } from "@/components/gantt/curriculum-view/tabs/weeks-tab/DaySelectionContext";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";

/**
 * Sets the working hours of every shift-selected day at once (#476). This
 * replaced the per-column override inputs in the header row, which could only
 * ever write one weekday across *all* weeks — the common case (a stretch of
 * days around a holiday, one short week) had no expression at all.
 *
 * Rendered only while something is selected, so it costs no space otherwise.
 */
export function BulkDayHoursBar() {
    const { clear, selectedDayIds } = useDaySelection();
    const { enqueueSnackbar } = useSnackbar();
    const { updateDay } = useWeekActions();
    const [value, setValue] = useState(() => formatMinutesAsTimeInput(480));
    const [isSaving, setIsSaving] = useState(false);

    const apply = useCallback(async () => {
        const minutes = parseTimeInputToMinutes(value);
        if (minutes === null) {
            enqueueSnackbar("שעות לא תקינות", { variant: "error" });
            return;
        }

        setIsSaving(true);
        try {
            await Promise.all(
                [...selectedDayIds].map((dayId) =>
                    updateDay(dayId, { totalWorkingMinutes: minutes }),
                ),
            );
            enqueueSnackbar(
                `שעות העבודה עודכנו ל-${selectedDayIds.size} ימים`,
                { variant: "success" },
            );
            clear();
        } catch (error) {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "עדכון שעות העבודה נכשל!",
                error,
            );
        } finally {
            setIsSaving(false);
        }
    }, [clear, enqueueSnackbar, selectedDayIds, updateDay, value]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                event.preventDefault();
                void apply();
            }
            if (event.key === "Escape") clear();
        },
        [apply, clear],
    );

    if (selectedDayIds.size === 0) return null;

    return (
        <Box
            sx={{
                position: "sticky",
                bottom: 8,
                zIndex: 9,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
            }}
        >
            <Paper
                elevation={6}
                sx={{
                    px: 2,
                    py: 1,
                    borderRadius: "14px",
                    border: "1px solid",
                    borderColor: "primary.main",
                    pointerEvents: "auto",
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1.5}>
                    <Typography fontWeight={700} variant="body2">
                        {selectedDayIds.size} ימים נבחרו
                    </Typography>
                    <TextField
                        autoFocus
                        label="שעות עבודה"
                        onChange={(event) => setValue(event.target.value)}
                        onKeyDown={handleKeyDown}
                        size="small"
                        slotProps={{
                            htmlInput: {
                                inputMode: "numeric",
                                style: {
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                    textAlign: "center",
                                    width: "5.5ch",
                                },
                            },
                        }}
                        value={value}
                    />
                    <Button
                        disabled={isSaving}
                        onClick={() => void apply()}
                        size="small"
                        variant="contained"
                    >
                    החלה
                    </Button>
                    <IconButton
                        aria-label="ביטול הבחירה"
                        onClick={clear}
                        size="small"
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Paper>
        </Box>
    );
}
