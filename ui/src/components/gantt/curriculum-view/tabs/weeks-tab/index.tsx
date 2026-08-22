import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import React, { memo, useCallback, useState } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { ApplyTemplateButton } from "@/components/gantt/curriculum-view/tabs/weeks-tab/ApplyTemplateButton";
import { CourseStartDateControl } from "@/components/gantt/curriculum-view/tabs/weeks-tab/CourseStartDateControl";
import { WeekLengthMenu } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekLengthMenu";
import { WeeksCapacityGrid } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeeksCapacityGrid";
import { WeeksSummaryBar } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeeksSummaryBar";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";

type WeeksTabProps = {
    curriculumId: GanttCurriculumId;
};
type ImportedWeekDay = {
    dayIndex: number;
    totalWorkingMinutes?: number;
    comment?: string;
};
type ImportedWeek = {
    comment?: string;
    weekendDuty?: boolean;
    days: Array<ImportedWeekDay>;
};

function WeeksTabInner({ curriculumId }: WeeksTabProps) {
    const curriculum = useCurriculum(curriculumId);
    const state = useCurriculumState();
    const [isCompact, setIsCompact] = useState(false);
    const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
    const {
        state: { isLoading, mappings },
    } = useGanttMappings();

    const { enqueueSnackbar } = useSnackbar();
    const { createWeek, updateWeek, deleteWeek, updateDay } = useWeekActions();

    const handleExportWeeks = useCallback(() => {
        if (!curriculum) return;
        try {
            const weeksData = curriculum.weeks
                .map((weekId) => {
                    const week = state.weeks[weekId];
                    if (!week) return null;
                    const days = (week.days ?? [])
                        .map((dayId) => {
                            const day = state.days[dayId];
                            if (!day) return null;
                            return {
                                dayIndex: day.dayIndex,
                                totalWorkingMinutes: day.totalWorkingMinutes,
                                comment: day.comment,
                            };
                        })
                        .filter(Boolean);
                    return {
                        comment: week.comment,
                        weekendDuty: week.weekendDuty,
                        days,
                    };
                })
                .filter(Boolean);

            const dataStr =
                "data:text/json;charset=utf-8," +
                encodeURIComponent(JSON.stringify(weeksData, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute(
                "download",
                `bluz-weeks-${curriculumId}.json`,
            );
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            enqueueSnackbar("שבועות הגאנט יוצאו בהצלחה!", {
                variant: "success",
            });
        } catch {
            enqueueSnackbar("ייצוא שבועות הגאנט נכשל!", { variant: "error" });
        }
    }, [curriculum, state.weeks, state.days, curriculumId, enqueueSnackbar]);

    const handleImportWeeks = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!curriculum) return;
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedWeeks: Array<ImportedWeek> = JSON.parse(
                        event.target?.result as string,
                    );
                    if (!Array.isArray(importedWeeks)) {
                        throw new Error(
                            "Invalid format: expected an array of weeks",
                        );
                    }

                    enqueueSnackbar("מתחיל ייבוא שבועות...", {
                        variant: "info",
                    });

                    const currentWeekIds = [...curriculum.weeks];
                    const finalWeekIds: Array<string> = [];
                    const createdWeeksMap = new Map<string, any>();

                    // 1. Delete excess weeks
                    for (let i = 0; i < currentWeekIds.length; i++) {
                        if (i < importedWeeks.length) {
                            finalWeekIds.push(currentWeekIds[i]);
                        } else {
                            await deleteWeek(currentWeekIds[i], curriculumId);
                        }
                    }

                    // 2. Create missing weeks
                    for (
                        let i = currentWeekIds.length;
                        i < importedWeeks.length;
                        i++
                    ) {
                        const newWeek = await createWeek({
                            curriculumId,
                            number: i + 1,
                            comment: "",
                            weekendDuty: false,
                        });
                        finalWeekIds.push(newWeek.id);
                        createdWeeksMap.set(newWeek.id, newWeek);
                    }

                    // 3. Update weeks and days
                    for (let i = 0; i < importedWeeks.length; i++) {
                        const weekId = finalWeekIds[i];
                        const importedWeek = importedWeeks[i];

                        // Find day IDs for this week
                        let dayIds: Array<string> = [];
                        const existingWeek = state.weeks[weekId];
                        if (
                            existingWeek &&
                            existingWeek.days &&
                            existingWeek.days.length > 0
                        ) {
                            dayIds = existingWeek.days;
                        } else {
                            const newlyCreatedWeek =
                                createdWeeksMap.get(weekId);
                            if (newlyCreatedWeek && newlyCreatedWeek.w2d) {
                                dayIds = newlyCreatedWeek.w2d.map(
                                    (link: { dayId: string }) => link.dayId,
                                );
                            }
                        }

                        // Update week attributes
                        await updateWeek(weekId, {
                            comment: importedWeek.comment ?? "",
                            weekendDuty: importedWeek.weekendDuty ?? false,
                        });

                        // Update day attributes
                        if (Array.isArray(importedWeek.days)) {
                            for (const dId of dayIds) {
                                let currentDayIndex: number | undefined =
                                    state.days[dId]?.dayIndex;
                                if (currentDayIndex === undefined) {
                                    const link = createdWeeksMap
                                        .get(weekId)
                                        ?.w2d?.find(
                                            (l: { dayId: string }) =>
                                                l.dayId === dId,
                                        );
                                    if (link) {
                                        currentDayIndex = link.day.dayIndex;
                                    }
                                }

                                const importedDay = importedWeek.days.find(
                                    (d) => d.dayIndex === currentDayIndex,
                                );
                                if (importedDay) {
                                    await updateDay(dId, {
                                        totalWorkingMinutes:
                                            importedDay.totalWorkingMinutes ??
                                            0,
                                        comment: importedDay.comment ?? "",
                                    });
                                }
                            }
                        }
                    }

                    enqueueSnackbar("ייבוא שבועות הגאנט הושלם בהצלחה!", {
                        variant: "success",
                    });
                } catch (error: unknown) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "ייבוא שבועות הגאנט נכשל!",
                        error,
                    );
                } finally {
                    e.target.value = "";
                }
            };
            reader.readAsText(file);
        },
        [
            curriculum,
            curriculumId,
            state.weeks,
            state.days,
            createWeek,
            updateWeek,
            deleteWeek,
            updateDay,
            enqueueSnackbar,
        ],
    );

    if (!curriculum) {
        return (
            <Box
                alignItems="center"
                display="flex"
                flex={1}
                justifyContent="center"
            >
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (
        <Box
            className="animate-slide-up-fade"
            display="flex"
            flexDirection="column"
            gap={1.5}
            height="100%"
            minHeight={0}
            sx={{ pl: 3.5, overflowY: "auto" }}
        >
            { /* Scrolls away with the table rather than pinning to the top
                 (#477): on a short screen a pinned card left almost nothing
                 for the weeks themselves. The day header row still sticks. */ }
            <Paper
                elevation={0}
                sx={{
                    flexShrink: 0,
                    zIndex: 8,
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "16px",
                    bgcolor: "background.default",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.04)",
                }}
            >
                <Stack spacing={1.5}>
                    <Box
                        alignItems="center"
                        display="flex"
                        flexWrap="wrap"
                        gap={2}
                        justifyContent="space-between"
                    >
                        <Box alignItems="center" display="flex" gap={1}>
                            <IconButton
                                aria-label={
                                    isSummaryCollapsed
                                        ? "הרחב את סיכום השבועות"
                                        : "צמצם את סיכום השבועות"
                                }
                                onClick={() =>
                                    setIsSummaryCollapsed((prev) => !prev)
                                }
                                size="small"
                            >
                                {isSummaryCollapsed ? (
                                    <ExpandMoreIcon fontSize="small" />
                                ) : (
                                    <ExpandLessIcon fontSize="small" />
                                )}
                            </IconButton>
                            <Box>
                                <Typography fontWeight={700} variant="h6">
                                    שבועות
                                </Typography>
                                <Typography
                                    color="text.secondary"
                                    variant="body2"
                                >
                                    אורך הקורס, תאריכים, שעות זמינות ושבתות
                                    בבסיס
                                </Typography>
                            </Box>
                        </Box>
                        <Stack alignItems="center" direction="row" spacing={1}>
                            <ApplyTemplateButton
                                curriculum={curriculum}
                                curriculumId={curriculumId}
                            />
                            <ImportExportMenuButton
                                color="primary"
                                exportLabel="ייצוא שבועות"
                                importLabel="ייבוא שבועות"
                                onExport={handleExportWeeks}
                                onImport={handleImportWeeks}
                                size="small"
                                triggerLabel="ייבוא / ייצוא שבועות"
                                variant="outlined"
                            />
                            <WeekLengthMenu
                                curriculum={curriculum}
                                curriculumId={curriculumId}
                            />
                        </Stack>
                    </Box>
                    <Collapse in={!isSummaryCollapsed}>
                        <Stack spacing={1.5}>
                            <Box
                                alignItems="center"
                                display="flex"
                                flexWrap="wrap"
                                gap={2}
                                justifyContent="space-between"
                            >
                                <CourseStartDateControl
                                    curriculum={curriculum}
                                    curriculumId={curriculumId}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={isCompact}
                                            onChange={(e) =>
                                                setIsCompact(e.target.checked)
                                            }
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Typography
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: "0.85rem",
                                                color: "text.secondary",
                                            }}
                                        >
                                            תצוגה מצומצמת
                                        </Typography>
                                    }
                                    sx={{ m: 0 }}
                                />
                            </Box>
                            <WeeksSummaryBar
                                curriculum={curriculum}
                                state={state}
                            />
                            {isLoading ? (
                                <Typography
                                    color="text.secondary"
                                    variant="caption"
                                >
                                    טוען שיבוצים קיימים...
                                </Typography>
                            ) : null}
                        </Stack>
                    </Collapse>
                </Stack>
            </Paper>
            <WeeksCapacityGrid
                curriculum={curriculum}
                isCompact={isCompact}
                mappings={mappings}
                state={state}
            />
        </Box>
    );
}

export const WeeksTab = memo(function WeeksTab({
    curriculumId,
}: WeeksTabProps) {
    return <WeeksTabInner curriculumId={curriculumId} />;
});
