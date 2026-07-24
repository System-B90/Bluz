import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { memo, useMemo } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttModuleRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttModuleRow";
import {
    GanttSyllabusGroupProps,
    SpanVariant,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useCurriculumState } from "@/components/gantt/state/provider";

const GanttSyllabusGroupComponent: React.FC<GanttSyllabusGroupProps> = ({
    syllabusId,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        weeklyView,
        timelineWeeks,
        dayIndexMap,
        weekIndexByDayId,
        moduleMappings,
        eventMappings,
        dayCellWidth,
        isSyllabusExpanded,
        toggleSyllabus,
        searchActive,
        isSyllabusVisible,
        isModuleVisible,
    } = useGanttContext();
    // While searching, force the group open so matching descendants show (#323).
    const isExpanded = searchActive || isSyllabusExpanded(syllabusId);

    const syllabus = state.syllabuses[syllabusId];

    // Day-level span (used in daily mode)
    const spanIndices = useMemo(() => {
        const allMappedDays = new Set<string>();

        (syllabus?.modules ?? []).forEach((moduleId) => {
            const ganttModule = state.modules[moduleId];
            if (!ganttModule) return;

            const mDays = moduleMappings[moduleId] || [];
            mDays.forEach((d) => allMappedDays.add(d));

            if (ganttModule.events) {
                ganttModule.events.forEach((eId) => {
                    const eDay = eventMappings[eId];
                    if (eDay) allMappedDays.add(eDay);
                });
            }
        });

        const indices = Array.from(allMappedDays)
            .map((id) => dayIndexMap.get(id) ?? -1)
            .filter((i) => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [syllabus, state.modules, moduleMappings, eventMappings, dayIndexMap]);

    // Week-level span (used in weekly mode)
    const weekSpanIndices = useMemo(() => {
        if (!weeklyView) return null;

        const allMappedDays = new Set<string>();

        (syllabus?.modules ?? []).forEach((moduleId) => {
            const ganttModule = state.modules[moduleId];
            if (!ganttModule) return;

            const mDays = moduleMappings[moduleId] || [];
            mDays.forEach((d) => allMappedDays.add(d));

            if (ganttModule.events) {
                ganttModule.events.forEach((eId) => {
                    const eDay = eventMappings[eId];
                    if (eDay) allMappedDays.add(eDay);
                });
            }
        });

        const weekIndices = new Set<number>();
        allMappedDays.forEach((dayId) => {
            const weekIdx = weekIndexByDayId.get(dayId);
            if (weekIdx !== undefined) weekIndices.add(weekIdx);
        });

        if (weekIndices.size === 0) return null;
        const arr = Array.from(weekIndices);
        return { min: Math.min(...arr), max: Math.max(...arr) };
    }, [
        weeklyView,
        syllabus,
        state.modules,
        moduleMappings,
        eventMappings,
        weekIndexByDayId,
    ]);

    if (!syllabus) return null;
    // Hide syllabuses with no match under the active search filter (#323).
    if (!isSyllabusVisible(syllabusId)) return null;

    const getSpanBorderRadius = (spanVariant: SpanVariant) => {
        switch (spanVariant) {
        case "start":
            return "4px 0 0 4px";
        case "end":
            return "0 4px 4px 0";
        case "single":
            return "4px";
        default:
            return "0";
        }
    };

    const computeSpanVariant = (
        idx: number,
        span: { min: number; max: number } | null,
    ): SpanVariant => {
        if (!span || idx < span.min || idx > span.max) return "none";
        if (span.min === span.max) return "single";
        if (idx === span.min) return "start";
        if (idx === span.max) return "end";
        return "middle";
    };

    const renderCells = () => {
        if (weeklyView) {
            return timelineWeeks.map((week, weekIdx) => {
                const spanVariant = computeSpanVariant(
                    weekIdx,
                    weekSpanIndices,
                );

                return (
                    <TableCell
                        key={week.id}
                        sx={{
                            backgroundColor: theme.vars.palette.background.default,
                            borderLeft: `1px solid ${theme.vars.palette.divider}`,
                            borderBottom: `1px solid ${theme.vars.palette.divider}`,
                            p: 0,
                            width: 80,
                            minWidth: 80,
                            boxSizing: "border-box",
                            position: "relative",
                        }}
                    >
                        {spanVariant !== "none" && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    left:
                                        spanVariant === "middle" ||
                                            spanVariant === "end"
                                            ? "-1px"
                                            : "4px",
                                    right:
                                        spanVariant === "middle" ||
                                            spanVariant === "start"
                                            ? "-1px"
                                            : "4px",
                                    height: "8px",
                                    backgroundColor:
                                        theme.vars.palette.text.secondary,
                                    opacity: 0.2,
                                    borderRadius:
                                        getSpanBorderRadius(spanVariant),
                                    zIndex: 1,
                                }}
                            />
                        )}
                    </TableCell>
                );
            });
        }

        return timelineWeeks.map((week) =>
            week.days.map((dayId) => {
                const dayIndex = dayIndexMap.get(dayId) ?? -1;
                const spanVariant = computeSpanVariant(dayIndex, spanIndices);

                return (
                    <TableCell
                        key={dayId}
                        sx={{
                            backgroundColor: theme.vars.palette.background.default,
                            borderLeft: `1px solid ${theme.vars.palette.divider}`,
                            borderBottom: `1px solid ${theme.vars.palette.divider}`,
                            p: 0,
                            width: dayCellWidth,
                            minWidth: dayCellWidth,
                            boxSizing: "border-box",
                            position: "relative",
                        }}
                    >
                        {spanVariant !== "none" && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    left:
                                        spanVariant === "middle" ||
                                            spanVariant === "end"
                                            ? "-1px"
                                            : "4px",
                                    right:
                                        spanVariant === "middle" ||
                                            spanVariant === "start"
                                            ? "-1px"
                                            : "4px",
                                    height: "8px",
                                    backgroundColor:
                                        theme.vars.palette.text.secondary,
                                    opacity: 0.2,
                                    borderRadius:
                                        getSpanBorderRadius(spanVariant),
                                    zIndex: 1,
                                }}
                            />
                        )}
                    </TableCell>
                );
            }),
        );
    };

    return (
        <React.Fragment>
            <TableRow
                hover
                onClick={() => toggleSyllabus(syllabusId)}
                sx={{ cursor: "pointer" }}
            >
                <TableCell
                    sx={{
                        width: 250,
                        minWidth: 250,
                        maxWidth: 250,
                        boxSizing: "border-box",
                        position: "sticky",
                        left: 0,
                        zIndex: 5,
                        backgroundColor: theme.vars.palette.background.default,
                        borderRight: `1px solid ${theme.vars.palette.divider}`,
                        borderBottom: `1px solid ${theme.vars.palette.divider}`,
                    }}
                >
                    <Typography
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        variant="subtitle2"
                    >
                        <Box
                            component="span"
                            sx={{ fontSize: "0.8rem", width: 16 }}
                        >
                            {isExpanded ? "▼" : "▶"}
                        </Box>
                        {syllabus.title}
                    </Typography>
                </TableCell>

                {renderCells()}
            </TableRow>

            {isExpanded
                ? syllabus.modules
                    .filter((moduleId) => isModuleVisible(moduleId))
                    .map((moduleId) => (
                        <GanttModuleRow key={moduleId} moduleId={moduleId} />
                    ))
                : null}
        </React.Fragment>
    );
};

export const GanttSyllabusGroup = memo(GanttSyllabusGroupComponent);
