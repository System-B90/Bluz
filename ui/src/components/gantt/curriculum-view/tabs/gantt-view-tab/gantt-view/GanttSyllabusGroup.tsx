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

function getSpanBorderRadius(spanVariant: SpanVariant) {
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
}

function computeSpanVariant(
    idx: number,
    span: { min: number; max: number } | null,
): SpanVariant {
    if (!span || idx < span.min || idx > span.max) return "none";
    if (span.min === span.max) return "single";
    if (idx === span.min) return "start";
    if (idx === span.max) return "end";
    return "middle";
}

/**
 * One timeline column of the collapsed syllabus row, carrying the segment of
 * the syllabus span bar that falls on this day (or week).
 */
function SyllabusSpanCell({
    spanVariant,
    width,
}: {
    spanVariant: SpanVariant;
    width: number;
}) {
    const theme = useTheme();
    const stretchStart = spanVariant === "middle" || spanVariant === "end";
    const stretchEnd = spanVariant === "middle" || spanVariant === "start";

    return (
        <TableCell
            sx={{
                backgroundColor: theme.vars.palette.background.default,
                borderLeft: `1px solid ${theme.vars.palette.divider}`,
                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                p: 0,
                width,
                minWidth: width,
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
                        left: stretchStart ? "-1px" : "4px",
                        right: stretchEnd ? "-1px" : "4px",
                        height: "8px",
                        backgroundColor: theme.vars.palette.text.secondary,
                        opacity: 0.2,
                        borderRadius: getSpanBorderRadius(spanVariant),
                        zIndex: 1,
                    }}
                />
            )}
        </TableCell>
    );
}

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

    // Every day id any module or event of this syllabus is mapped to.
    const mappedDays = useMemo(() => {
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

        return allMappedDays;
    }, [syllabus, state.modules, moduleMappings, eventMappings]);

    // Day-level span (used in daily mode)
    const spanIndices = useMemo(() => {
        const indices = Array.from(mappedDays)
            .map((id) => dayIndexMap.get(id) ?? -1)
            .filter((i) => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [mappedDays, dayIndexMap]);

    // Week-level span (used in weekly mode)
    const weekSpanIndices = useMemo(() => {
        if (!weeklyView) return null;

        const weekIndices = new Set<number>();
        mappedDays.forEach((dayId) => {
            const weekIdx = weekIndexByDayId.get(dayId);
            if (weekIdx !== undefined) weekIndices.add(weekIdx);
        });

        if (weekIndices.size === 0) return null;
        const arr = Array.from(weekIndices);
        return { min: Math.min(...arr), max: Math.max(...arr) };
    }, [weeklyView, mappedDays, weekIndexByDayId]);

    if (!syllabus) return null;
    // Hide syllabuses with no match under the active search filter (#323).
    if (!isSyllabusVisible(syllabusId)) return null;

    const renderCells = () => {
        if (weeklyView) {
            return timelineWeeks.map((week, weekIdx) => (
                <SyllabusSpanCell
                    key={week.id}
                    spanVariant={computeSpanVariant(weekIdx, weekSpanIndices)}
                    width={80}
                />
            ));
        }

        return timelineWeeks.map((week) =>
            week.days.map((dayId) => (
                <SyllabusSpanCell
                    key={dayId}
                    spanVariant={computeSpanVariant(
                        dayIndexMap.get(dayId) ?? -1,
                        spanIndices,
                    )}
                    width={dayCellWidth}
                />
            )),
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
