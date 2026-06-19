"use client";

import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { MouseEvent, useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttCurriculum,
    GanttCurriculumId,
    GanttDayIndex,
} from "@/api-shared/types/gantt/models";
import {
    CURRICULUM_TEMPLATES,
    GanttCurriculumTemplate,
    resolveWeekDayMinutes,
} from "@/api-shared/types/gantt/templates";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculumState } from "@/components/gantt/state/provider";

const ALL_DAY_INDICES: Array<GanttDayIndex> = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
    GanttDayIndex.Saturday,
];

type Props = {
    curriculum: GanttCurriculum;
    curriculumId: GanttCurriculumId;
};

export function ApplyTemplateButton({ curriculum, curriculumId }: Props) {
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const { createWeek, deleteWeek, updateWeek, updateDay } = useWeekActions();

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [pendingTemplate, setPendingTemplate] =
        useState<GanttCurriculumTemplate | null>(null);
    const [isApplying, setIsApplying] = useState(false);

    const openMenu = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(e.currentTarget);
    }, []);

    const closeMenu = useCallback(() => setAnchorEl(null), []);

    const handleSelectTemplate = useCallback(
        (template: GanttCurriculumTemplate) => {
            closeMenu();
            setPendingTemplate(template);
        },
        [closeMenu],
    );

    const applyTemplate = useCallback(async () => {
        if (!pendingTemplate) return;
        setIsApplying(true);
        setPendingTemplate(null);

        try {
            const currentWeekIds = [...curriculum.weeks];
            const targetCount = pendingTemplate.weekCount;

            // 1. Delete excess weeks (from the end)
            for (let i = currentWeekIds.length - 1; i >= targetCount; i--) {
                const weekId = currentWeekIds[i];
                if (weekId) {
                    await deleteWeek(weekId, curriculumId);
                }
            }

            // 2. Create missing weeks
            const finalWeekIds: Array<string> = [
                ...currentWeekIds.slice(0, targetCount),
            ];
            for (let i = currentWeekIds.length; i < targetCount; i++) {
                const newWeek = await createWeek({
                    curriculumId,
                    number: i + 1,
                    comment: "",
                    weekendDuty: false,
                });
                finalWeekIds.push(newWeek.id);
            }

            // 3. Apply day-minutes for each week
            for (let weekIndex = 0; weekIndex < finalWeekIds.length; weekIndex++) {
                const weekId = finalWeekIds[weekIndex];
                if (!weekId) continue;

                const dayMinutes = resolveWeekDayMinutes(
                    pendingTemplate,
                    weekIndex,
                );

                const week = state.weeks[weekId];
                const dayIds = week?.days ?? [];

                // Update week comment/weekendDuty for Saturday awareness
                const hasSaturdayDuty =
                    (dayMinutes[GanttDayIndex.Saturday] ?? 0) > 0;
                await updateWeek(weekId, { weekendDuty: hasSaturdayDuty });

                // Update each day's totalWorkingMinutes
                for (const dayId of dayIds) {
                    const day = state.days[dayId];
                    if (!day) continue;

                    const minutes =
                        dayMinutes[day.dayIndex as GanttDayIndex] ?? 0;
                    if (day.totalWorkingMinutes !== minutes) {
                        await updateDay(dayId, {
                            totalWorkingMinutes: minutes,
                        });
                    }
                }

                // Handle newly-created weeks whose days aren't in state yet.
                // Re-read from the API response stored in state after dispatch settles.
                // (State refresh happens via reducer; weeks created above already dispatched ADD_WEEK / ADD_DAY.)
                const freshWeek = state.weeks[weekId];
                if (freshWeek && freshWeek.days.length > 0) {
                    for (const dayId of freshWeek.days) {
                        const day = state.days[dayId];
                        if (!day) continue;
                        const minutes =
                            dayMinutes[day.dayIndex as GanttDayIndex] ?? 0;
                        if (day.totalWorkingMinutes !== minutes) {
                            await updateDay(dayId, {
                                totalWorkingMinutes: minutes,
                            });
                        }
                    }
                }
            }

            enqueueSnackbar(
                `התבנית "${pendingTemplate.label}" הוחלה בהצלחה על ${targetCount} שבועות!`,
                { variant: "success" },
            );
        } catch (error) {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "החלת התבנית נכשלה!",
                error,
            );
        } finally {
            setIsApplying(false);
        }
    }, [
        pendingTemplate,
        curriculum.weeks,
        curriculumId,
        state.weeks,
        state.days,
        createWeek,
        deleteWeek,
        updateWeek,
        updateDay,
        enqueueSnackbar,
    ]);

    return (
        <>
            <Button
                disabled={isApplying}
                endIcon={<AutoFixHighIcon />}
                onClick={openMenu}
                size="small"
                variant="outlined"
            >
                {isApplying ? "מחיל תבנית..." : "בחר תבנית"}
            </Button>

            <Menu
                anchorEl={anchorEl}
                onClose={closeMenu}
                open={Boolean(anchorEl)}
            >
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <Typography
                        color="text.secondary"
                        sx={{ fontSize: "0.75rem", fontWeight: 700 }}
                        variant="caption"
                    >
                        תבניות קורס
                    </Typography>
                </MenuItem>
                <Divider />
                {CURRICULUM_TEMPLATES.map((template) => (
                    <MenuItem
                        key={template.id}
                        onClick={() => handleSelectTemplate(template)}
                    >
                        <ListItemText
                            primary={template.label}
                            secondary={`${template.weekCount} שבועות`}
                            slotProps={{
                                secondary: {
                                    sx: { fontSize: "0.72rem" },
                                },
                            }}
                        />
                    </MenuItem>
                ))}
            </Menu>

            <Dialog
                onClose={() => !isApplying && setPendingTemplate(null)}
                open={Boolean(pendingTemplate)}
            >
                <DialogTitle>החלת תבנית קורס</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        החלת תבנית <strong>{pendingTemplate?.label}</strong>{" "}
                        תשנה את מספר השבועות ל-
                        <strong>{pendingTemplate?.weekCount}</strong> ותעדכן את
                        שעות העבודה לפי התבנית. שבועות עודפים יימחקו. פעולה זו
                        אינה הפיכה.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPendingTemplate(null)}>
                        ביטול
                    </Button>
                    <Button
                        color="primary"
                        onClick={() => void applyTemplate()}
                        variant="contained"
                    >
                        החל תבנית
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
