import { useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React from "react";

import { getDayNameDisplay } from "@/api-shared/types/gantt/models";
import {
    formatShortDate,
    formatWeekDateRange,
    getDayDate,
    getWeekDateRange,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { useCurriculumState } from "@/components/gantt/state/provider";

export const GanttHeader: React.FC = () => {
    const theme = useTheme();
    const state = useCurriculumState();
    const { startDate, timelineWeeks, weeklyView } = useGanttContext();

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
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <Typography fontWeight="bold" variant="subtitle2">
                        סילבוס / מערך
                    </Typography>
                </TableCell>
                {timelineWeeks.map((week, weekIndex) => {
                    const dateRangeLabel = formatWeekDateRange(
                        getWeekDateRange(startDate, weekIndex),
                    );

                    return (
                        <TableCell
                            align="center"
                            colSpan={weeklyView ? 1 : week.days.length}
                            key={week.id}
                            sx={{
                                borderLeft: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.vars.palette.background.paper,
                                zIndex: 2,
                            }}
                        >
                            <Typography fontWeight="bold" variant="subtitle2">
                                {week.title}
                            </Typography>
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
                                weekIndex,
                                day.dayIndex,
                            );
                            return (
                                <TableCell
                                    align="center"
                                    key={dayId}
                                    sx={{
                                        width: 80,
                                        minWidth: 80,
                                        boxSizing: "border-box",
                                        borderLeft: `1px solid ${theme.palette.divider}`,
                                        backgroundColor:
                                            theme.vars.palette.background.paper,
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
