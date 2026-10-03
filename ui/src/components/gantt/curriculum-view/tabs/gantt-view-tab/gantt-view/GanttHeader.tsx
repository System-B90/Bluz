import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
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
import { StudentLoadTooltip } from "@/components/gantt/curriculum-view/components/StudentLoadTooltip";
import {
    CapacityStatus,
    formatHoursLabel,
    formatShortDate,
    formatWeekDateRange,
    getCapacityStatus,
    getDayDate,
    getWeekDateRange,
    getWeekOverAllocationSeverity,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { sumStudentMinutes } from "@/components/gantt/curriculum-view/student-load";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { useCurriculumState } from "@/components/gantt/state/context";

function getCapacityColor(status: CapacityStatus): string {
    if (status === "error") return "error.main";
    if (status === "warning") return "warning.main";
    if (status === "ok") return "primary.main";

    return "text.secondary";
}

/** `X ש׳ / Y ש׳` reads the same in every week, so line the digits up (#829). */
const HOURS_SX = { fontVariantNumeric: "tabular-nums" } as const;

/** Spoken/hovered meaning of the `X / Y` pair, which on screen has no labels (#812). */
export function hoursPairDescription(scheduledMinutes: number, availableMinutes: number): string {
    return `משובץ ${formatHoursLabel(scheduledMinutes)} מתוך ${formatHoursLabel(availableMinutes)} זמינות`;
}

export const GanttHeader: React.FC<{ showConstraints: boolean }> = ({
    showConstraints,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        dayCellWidth,
        ignoreBreaks,
        scheduledMinutesByDay,
        setWeeklyView,
        setZoomedWeekId,
        singleWeekDayZoom,
        startDate,
        studentLoadByDay,
        studentPaths,
        timelineWeeks,
        weeklyView,
        weekIndexOffset,
        zoomedWeekId,
    } = useGanttContext();
    // Clicking a week header always zooms into that week's day view (#445) —
    // including from the compact weekly view, which this used to disallow.
    const canZoom = true;
    // "Ignore breaks" takes the day's break time out of its available hours too.
    const availableOf = (day: { id: string; totalWorkingMinutes: number }) =>
        day.totalWorkingMinutes
        - (ignoreBreaks ? (studentLoadByDay[day.id]?.breakMinutes ?? 0) : 0);

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

                    // Always resolved: the week's allocated / available hours
                    // are shown regardless of the constraints toggle (#766).
                    const weekDays = week.days
                        .map((dayId) => state.days[dayId])
                        .filter((day) => !!day);
                    const constraintDays = showConstraints ? weekDays : [];

                    const overAllocatedDayNames = constraintDays
                        .filter(
                            (day) =>
                                getCapacityStatus(
                                    availableOf(day),
                                    scheduledMinutesByDay[day.id] ?? 0,
                                ) === "error",
                        )
                        .map((day) => getDayNameDisplay(day.dayIndex));

                    // A single overloaded day is amber: the work still fits in
                    // the week and can be moved to another day. Red is reserved
                    // for the week as a whole being over its available hours,
                    // which no reshuffling inside the week can fix (#467).
                    const weekAvailableMinutes = weekDays.reduce(
                        (total, day) => total + availableOf(day),
                        0,
                    );
                    // A student's week is the sum of their own days.
                    const weekScheduledMinutes = sumStudentMinutes(
                        studentLoadByDay,
                        week.days,
                    );
                    const weekSeverity = getWeekOverAllocationSeverity(
                        constraintDays.map((day) => ({
                            availableMinutes: availableOf(day),
                            scheduledMinutes: scheduledMinutesByDay[day.id] ?? 0,
                        })),
                    );
                    // Set on the text children, not the cell, so the native
                    // tooltip never stacks on the warning icon's tooltip.
                    const zoomTitle = canZoom
                        ? zoomedWeekId === week.id
                            ? "יציאה ממצב מוגדל"
                            : "התמקדות בשבוע"
                        : undefined;

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
                                    // action.hover is translucent; tint over the
                                    // opaque paper so scrolled content can't bleed through.
                                    "&:hover": {
                                        backgroundImage: `linear-gradient(${theme.vars.palette.action.hover}, ${theme.vars.palette.action.hover})`,
                                    },
                                }),
                            }}
                        >
                            <Box
                                alignItems="center"
                                display="flex"
                                gap={0.5}
                                justifyContent="center"
                            >
                                <Typography fontWeight="bold" title={zoomTitle} variant="subtitle2">
                                    {week.title}
                                </Typography>
                                {/* Week-level problems only get the ⚠ (#812): the
                                    week needs more hours than it has. A single
                                    overloaded day is a quieter amber dot here,
                                    and is marked on the day itself in the daily
                                    view. Tooltips open above, off the numbers. */}
                                {weeklyView && weekSeverity === "error" ? (
                                    <Tooltip
                                        arrow
                                        placement="top"
                                        title={`חריגה בהקצאת השבוע: ${formatHoursLabel(weekScheduledMinutes)} מתוך ${formatHoursLabel(weekAvailableMinutes)}`}
                                    >
                                        <WarningAmberIcon
                                            aria-label="חריגה בהקצאת השבוע"
                                            color="error"
                                            data-testid="gantt-week-overload"
                                            role="img"
                                            sx={{ fontSize: 16 }}
                                        />
                                    </Tooltip>
                                ) : null}
                                {weeklyView && weekSeverity === "warning" ? (
                                    <Tooltip
                                        arrow
                                        placement="top"
                                        title={`ימים בחריגה: ${overAllocatedDayNames.join(", ")}`}
                                    >
                                        <FiberManualRecordIcon
                                            aria-label={`ימים בחריגה: ${overAllocatedDayNames.join(", ")}`}
                                            color="warning"
                                            data-testid="gantt-week-day-overload"
                                            role="img"
                                            sx={{ fontSize: 10 }}
                                        />
                                    </Tooltip>
                                ) : null}
                            </Box>
                            {dateRangeLabel ? (
                                <Typography
                                    color="text.secondary"
                                    title={zoomTitle}
                                    variant="caption"
                                >
                                    {dateRangeLabel}
                                </Typography>
                            ) : null}
                            <Typography
                                color={getCapacityColor(
                                    getCapacityStatus(
                                        weekAvailableMinutes,
                                        weekScheduledMinutes,
                                    ),
                                )}
                                data-testid="gantt-week-hours"
                                display="block"
                                fontWeight={700}
                                sx={HOURS_SX}
                                title={`${hoursPairDescription(weekScheduledMinutes, weekAvailableMinutes)}${zoomTitle ? ` · ${zoomTitle}` : ""}`}
                                variant="caption"
                            >
                                {`${formatHoursLabel(weekScheduledMinutes)} / ${formatHoursLabel(weekAvailableMinutes)}`}
                            </Typography>
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
                                availableOf(day),
                                scheduledMinutes,
                            );
                            const isOverAllocated =
                                showConstraints && capacityStatus === "error";
                            const hasLoadIssues =
                                (studentLoadByDay[dayId]?.issues.length ?? 0) > 0;
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
                                    <Box
                                        alignItems="center"
                                        display="flex"
                                        gap={0.25}
                                        justifyContent="center"
                                    >
                                        <Typography variant="caption">
                                            {getDayNameDisplay(day.dayIndex)}
                                        </Typography>
                                        {isOverAllocated ? (
                                            <Tooltip
                                                arrow
                                                placement="top"
                                                title={`חריגה מהשעות הזמינות ביום: ${hoursPairDescription(scheduledMinutes, availableOf(day))}`}
                                            >
                                                <WarningAmberIcon
                                                    aria-label="חריגה מהשעות הזמינות ביום"
                                                    color="error"
                                                    data-testid="gantt-day-overload"
                                                    role="img"
                                                    sx={{ fontSize: 14 }}
                                                />
                                            </Tooltip>
                                        ) : null}
                                    </Box>
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
                                        <StudentLoadTooltip
                                            capacity={availableOf(day)}
                                            load={studentLoadByDay[dayId]}
                                            paths={studentPaths}
                                            title={dayDate
                                                ? `${getDayNameDisplay(day.dayIndex)} ${formatShortDate(dayDate)}`
                                                : getDayNameDisplay(day.dayIndex)}
                                        >
                                            <Box
                                                alignItems="center"
                                                data-testid="gantt-day-hours"
                                                display="flex"
                                                gap={0.25}
                                                justifyContent="center"
                                            >
                                                {hasLoadIssues ? (
                                                    <WarningAmberIcon
                                                        color="warning"
                                                        data-testid="gantt-day-load-issue"
                                                        sx={{ fontSize: 14 }}
                                                    />
                                                ) : null}
                                                <Typography
                                                    color={getCapacityColor(
                                                        capacityStatus,
                                                    )}
                                                    fontWeight={700}
                                                    sx={HOURS_SX}
                                                    variant="caption"
                                                >
                                                    {`${formatHoursLabel(
                                                        scheduledMinutes,
                                                    )} / ${formatHoursLabel(
                                                        availableOf(day),
                                                    )}`}
                                                </Typography>
                                            </Box>
                                        </StudentLoadTooltip>
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
