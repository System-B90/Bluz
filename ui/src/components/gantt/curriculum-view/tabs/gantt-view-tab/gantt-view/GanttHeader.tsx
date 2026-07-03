import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

import { getDayNameDisplay } from "@/api-shared/types/gantt/models";
import {
    formatShortDate,
    formatWeekDateRange,
    getCapacityStatus,
    getDayDate,
    getWeekDateRange,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { useCurriculumState } from "@/components/gantt/state/provider";

export const GanttHeader: React.FC = () => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        dayCellWidth,
        scheduledMinutesByDay,
        setZoomedWeekId,
        showConstraints,
        startDate,
        timelineWeeks,
        weeklyView,
        weekIndexOffset,
        zoomedWeekId,
    } = useGanttContext();
    const canZoom = !weeklyView;

    return (
        <TableHead>
            <TableRow>
                <TableCell
                    rowSpan={weeklyView ? 1 : 2}
                    sx={{
                        width: 250,
                        minWidth: 250,
                        maxWidth: 250,
                        boxSizing: "border-box",
                        backgroundColor: theme.vars.palette.background.paper,
                        position: "sticky",
                        left: 0,
                        top: 0,
                        // Elevated zIndex to stay above horizontal scrolls entirely
                        zIndex: 6,
                        borderRight: `1px solid ${theme.vars.palette.divider}`,
                        borderBottom: `1px solid ${theme.vars.palette.divider}`,
                    }}
                >
                    <Typography fontWeight="bold" variant="subtitle2">
                        סילבוס / מערך
                    </Typography>
                </TableCell>
                {timelineWeeks.map((week, weekIndex) => {
                    const dateRangeLabel = formatWeekDateRange(
                        getWeekDateRange(
                            startDate,
                            weekIndex + weekIndexOffset,
                        ),
                    );

                    const overAllocatedDayNames = showConstraints
                        ? week.days
                            .map((dayId) => state.days[dayId])
                            .filter(
                                (day) =>
                                    !!day &&
                                    getCapacityStatus(
                                        day.totalWorkingMinutes,
                                        scheduledMinutesByDay[day.id] ?? 0,
                                    ) === "error",
                            )
                            .map((day) => getDayNameDisplay(day!.dayIndex))
                        : [];

                    return (
                        <TableCell
                            align="center"
                            colSpan={weeklyView ? 1 : week.days.length}
                            key={week.id}
                            onClick={
                                canZoom
                                    ? () =>
                                        setZoomedWeekId(
                                            zoomedWeekId === week.id
                                                ? null
                                                : week.id,
                                        )
                                    : undefined
                            }
                            sx={{
                                borderLeft: `1px solid ${theme.vars.palette.divider}`,
                                backgroundColor: theme.vars.palette.background.paper,
                                zIndex: 2,
                                cursor: canZoom ? "pointer" : "default",
                                userSelect: "none",
                                ...(canZoom && {
                                    "&:hover": {
                                        backgroundColor:
                                            theme.vars.palette.action.hover,
                                    },
                                }),
                            }}
                            title={
                                canZoom
                                    ? zoomedWeekId === week.id
                                        ? "יציאה ממצב מוגדל"
                                        : "התמקדות בשבוע"
                                    : undefined
                            }
                        >
                            <Box
                                alignItems="center"
                                display="flex"
                                gap={0.5}
                                justifyContent="center"
                            >
                                <Typography fontWeight="bold" variant="subtitle2">
                                    {week.title}
                                </Typography>
                                {weeklyView && overAllocatedDayNames.length > 0 ? <Tooltip
                                    arrow
                                    title={`חריגה בהקצאה: ${overAllocatedDayNames.join(", ")}`}
                                >
                                    <WarningAmberIcon
                                        color="error"
                                        sx={{ fontSize: 16 }}
                                    />
                                </Tooltip> : null}
                            </Box>
                            {dateRangeLabel ? (
                                <Typography
                                    color="text.secondary"
                                    variant="caption"
                                >
                                    {dateRangeLabel}
                                </Typography>
                            ) : null}
                        </TableCell>
                    );
                })}
            </TableRow>
            {!weeklyView && (
                <TableRow>
                    {timelineWeeks.map((week, weekIndex) =>
                        week.days.map((dayId) => {
                            const day = state.days[dayId];
                            if (!day) return null;
                            const dayDate = getDayDate(
                                startDate,
                                weekIndex + weekIndexOffset,
                                day.dayIndex,
                            );
                            const isOverAllocated =
                                showConstraints &&
                                getCapacityStatus(
                                    day.totalWorkingMinutes,
                                    scheduledMinutesByDay[dayId] ?? 0,
                                ) === "error";
                            return (
                                <TableCell
                                    align="center"
                                    key={dayId}
                                    sx={{
                                        width: dayCellWidth,
                                        minWidth: dayCellWidth,
                                        boxSizing: "border-box",
                                        borderLeft: `1px solid ${theme.vars.palette.divider}`,
                                        backgroundColor: isOverAllocated
                                            ? alpha(theme.palette.error.main, 0.12)
                                            : theme.vars.palette.background.paper,
                                        zIndex: 2,
                                    }}
                                >
                                    <Typography variant="caption">
                                        {getDayNameDisplay(day.dayIndex)}
                                    </Typography>
                                    {dayDate ? (
                                        <Typography
                                            color="text.secondary"
                                            display="block"
                                            variant="caption"
                                        >
                                            {formatShortDate(dayDate)}
                                        </Typography>
                                    ) : null}
                                </TableCell>
                            );
                        }),
                    )}
                </TableRow>
            )}
        </TableHead>
    );
};
