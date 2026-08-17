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
    CapacityStatus,
    formatHoursLabel,
    formatShortDate,
    formatWeekDateRange,
    getCapacityStatus,
    getDayDate,
    getWeekDateRange,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { useCurriculumState } from "@/components/gantt/state/provider";

function getCapacityColor(status: CapacityStatus): string {
    if (status === "error") return "error.main";
    if (status === "warning") return "warning.main";
    if (status === "ok") return "primary.main";

    return "text.secondary";
}

export const GanttHeader: React.FC<{ showConstraints: boolean }> = ({
    showConstraints,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        dayCellWidth,
        scheduledMinutesByDay,
        setWeeklyView,
        setZoomedWeekId,
        singleWeekDayZoom,
        startDate,
        timelineWeeks,
        weeklyView,
        weekIndexOffset,
        zoomedWeekId,
    } = useGanttContext();
    // Clicking a week header always zooms into that week's day view (#445) —
    // including from the compact weekly view, which this used to disallow.
    const canZoom = true;

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

                    const weekDays = showConstraints
                        ? week.days
                            .map((dayId) => state.days[dayId])
                            .filter((day) => !!day)
                        : [];

                    const overAllocatedDayNames = weekDays
                        .filter(
                            (day) =>
                                getCapacityStatus(
                                    day.totalWorkingMinutes,
                                    scheduledMinutesByDay[day.id] ?? 0,
                                ) === "error",
                        )
                        .map((day) => getDayNameDisplay(day.dayIndex));

                    // A single overloaded day is amber: the work still fits in
                    // the week and can be moved to another day. Red is reserved
                    // for the week as a whole being over its available hours,
                    // which no reshuffling inside the week can fix (#467).
                    const weekAvailableMinutes = weekDays.reduce(
                        (total, day) => total + day.totalWorkingMinutes,
                        0,
                    );
                    const weekScheduledMinutes = weekDays.reduce(
                        (total, day) =>
                            total + (scheduledMinutesByDay[day.id] ?? 0),
                        0,
                    );
                    const weekOverAllocated =
                        weekScheduledMinutes > weekAvailableMinutes;

                    return (
                        <TableCell
                            align="center"
                            colSpan={weeklyView ? 1 : week.days.length}
                            key={week.id}
                            onClick={
                                canZoom
                                    ? () => {
                                        if (weeklyView) {
                                            // Already in weekly view: always zoom
                                            // into this week's day view (#445).
                                            setWeeklyView(false);
                                            setZoomedWeekId(week.id);
                                            return;
                                        }
                                        setZoomedWeekId(
                                            zoomedWeekId === week.id
                                                ? null
                                                : week.id,
                                        );
                                    }
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
                                {weeklyView &&
                                (overAllocatedDayNames.length > 0 ||
                                    weekOverAllocated) ? <Tooltip
                                        arrow
                                        title={
                                            weekOverAllocated
                                                ? `חריגה בהקצאת השבוע: ${formatHoursLabel(weekScheduledMinutes)} מתוך ${formatHoursLabel(weekAvailableMinutes)}`
                                                : `חריגה בהקצאה: ${overAllocatedDayNames.join(", ")}`
                                        }
                                    >
                                        <WarningAmberIcon
                                            color={
                                                weekOverAllocated
                                                    ? "error"
                                                    : "warning"
                                            }
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
                            const scheduledMinutes =
                                scheduledMinutesByDay[dayId] ?? 0;
                            const capacityStatus = getCapacityStatus(
                                day.totalWorkingMinutes,
                                scheduledMinutes,
                            );
                            const isOverAllocated =
                                showConstraints && capacityStatus === "error";
                            return (
                                <TableCell
                                    align="center"
                                    key={dayId}
                                    sx={{
                                        width: dayCellWidth,
                                        minWidth: dayCellWidth,
                                        boxSizing: "border-box",
                                        borderLeft: `1px solid ${theme.vars.palette.divider}`,
                                        // Opaque base first: `alpha()` alone leaves the sticky
                                        // header translucent, so body rows show through it while
                                        // scrolling (#446). Layer the tint as a backgroundImage
                                        // on top of a solid backgroundColor instead.
                                        backgroundColor: theme.vars.palette.background.paper,
                                        backgroundImage: isOverAllocated
                                            ? `linear-gradient(${alpha(theme.palette.error.main, 0.12)}, ${alpha(theme.palette.error.main, 0.12)})`
                                            : "none",
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
                                    {singleWeekDayZoom ? (
                                        <Typography
                                            color={getCapacityColor(
                                                capacityStatus,
                                            )}
                                            display="block"
                                            fontWeight={700}
                                            variant="caption"
                                        >
                                            {`${formatHoursLabel(
                                                scheduledMinutes,
                                            )} / ${formatHoursLabel(
                                                day.totalWorkingMinutes,
                                            )}`}
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
