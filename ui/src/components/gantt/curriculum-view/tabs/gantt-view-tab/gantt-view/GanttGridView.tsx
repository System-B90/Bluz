import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Paper from "@mui/material/Paper";
import { alpha, Theme } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
    formatHours,
    getWeekTotalMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { buildGridRows, GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { GanttViewProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/UseGanttView";
import { useHoursFormat } from "@/components/gantt/curriculum-view/use-hours-format";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/context";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

/** Leading columns before the weeks: title, required, allocated. */
const LEAD_COLUMNS = 3;

/** Column widths (px). Hour columns are static; the title column takes the rest and wraps. */
const TITLE_MIN_WIDTH = 220;
const HOURS_WIDTH = 64;
const WEEK_WIDTH = 88;

/** Two digits so a quarter hour reads 0.75, not 0.8. */
const hours = (minutes: number) => formatHours(minutes, 2);
const hoursOrBlank = (minutes: number) => (minutes ? hours(minutes) : "");
/** Opaque error tint: the tint layered over paper, so sticky cells hide what scrolls beneath. */
const errorTint = {
    bgcolor: "background.paper",
    backgroundImage: (theme: Theme) =>
    {
        const tint = alpha(theme.palette.error.main, 0.12);
        return `linear-gradient(${tint}, ${tint})`;
    },
};

/**
 * Spreadsheet-style gantt: weeks as columns, events as rows, each cell the
 * hours the event takes that week (recurrence echoes and week splits
 * included). Syllabus/module summary rows sum their children and collapse.
 * Arrow keys move the selected cell; Enter toggles a summary row or opens an
 * event's dialog.
 */
export const GanttGridView: React.FC<GanttViewProps> = ({ curriculumId }) =>
{
    const state = useCurriculumState();
    const { openEventDialog } = useCurriculumProviderActions();
    const { state: { exceptions } } = useGanttRecurrenceExceptions();
    const { curriculum, contextValue } = useGanttView(curriculumId);
    const {
        allLinearDays,
        curriculumMappings,
        dateOfDayId,
        eventSpans,
        isModuleExpanded,
        isSyllabusExpanded,
        timelineWeeks,
        toggleModule,
        toggleSyllabus,
        weekIndexByDayId,
    } = contextValue;
    const weekCount = timelineWeeks.length;
    // Re-render on a decimal/clock switch from the page toolbar.
    useHoursFormat();

    const rows = useMemo(
        () => buildGridRows(
            curriculum?.syllabuses ?? [],
            {
                dateOf: dateOfDayId,
                eventSpans,
                exceptions,
                linearDays: allLinearDays,
                mappings: curriculumMappings,
                state,
                weekIndexByDayId,
                weeks: timelineWeeks.map((week) => week.days),
            },
            isSyllabusExpanded,
            isModuleExpanded,
        ),
        [
            allLinearDays, curriculum?.syllabuses, curriculumMappings, dateOfDayId, eventSpans, exceptions,
            isModuleExpanded, isSyllabusExpanded, state, timelineWeeks, weekIndexByDayId,
        ],
    );

    // Syllabus rows are always present and sum everything under them.
    const usedByWeek = rows
        .filter((r) => r.kind === "syllabus")
        .reduce((sum, r) => sum.map((m, w) => m + r.weekMinutes[ w ]), new Array<number>(weekCount).fill(0));
    const availableByWeek = timelineWeeks.map((week) => getWeekTotalMinutes(week, state));

    const [ cursor, setCursor ] = useState({ row: 0, col: 0 });
    const row = Math.min(cursor.row, rows.length - 1);
    const col = Math.min(cursor.col, LEAD_COLUMNS + weekCount - 1);
    const selectedRef = useRef<HTMLTableCellElement>(null);

    useEffect(() =>
    {
        selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [ row, col ]);

    const activate = (target: GridRow) =>
    {
        if (target.kind === "syllabus") toggleSyllabus(target.id);
        else if (target.kind === "module") toggleModule(target.id);
        else openEventDialog(target.syllabusId, target.moduleId, target.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) =>
    {
        // RTL: ArrowLeft moves forward in time.
        const moves: Record<string, [number, number]> = {
            ArrowUp: [ -1, 0 ],
            ArrowDown: [ 1, 0 ],
            ArrowLeft: [ 0, 1 ],
            ArrowRight: [ 0, -1 ],
            Home: [ 0, -Infinity ],
            End: [ 0, Infinity ],
        };
        const move = moves[ e.key ];
        if (move)
        {
            e.preventDefault();
            const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));
            setCursor({
                row: clamp(row + move[ 0 ], rows.length - 1),
                col: clamp(col + move[ 1 ], LEAD_COLUMNS + weekCount - 1),
            });
        }
        else if ((e.key === "Enter" || e.key === " ") && rows[ row ])
        {
            e.preventDefault();
            activate(rows[ row ]);
        }
    };

    if (!curriculum) return <Typography sx={ { p: 2 } }>טוען גאנט...</Typography>;

    const cellSx = (r: number, c: number, kind: GridRow["kind"], depth = 0) => ({
        paddingInlineStart: c === 0 ? 1 + depth * 2 : 1,
        fontVariantNumeric: "tabular-nums",
        fontWeight: kind === "event" ? "normal" : "bold",
        overflowWrap: "anywhere",
        textAlign: c === 0 ? "start" : "center",
        outline: r === row && c === col ? "2px solid" : "none",
        outlineColor: "primary.main",
        outlineOffset: -2,
    });

    return (
        <Paper elevation={ 0 } sx={ { mt: 2, width: "100%", overflow: "hidden" } }>
            <TableContainer
                aria-label="טבלת גאנט"
                onKeyDown={ handleKeyDown }
                role="grid"
                sx={ { maxHeight: "calc(100vh - 180px)", "&:focus": { outline: "none" } } }
                tabIndex={ 0 }
            >
                <Table
                    size="small"
                    sx={ {
                        tableLayout: "fixed",
                        width: "100%",
                        minWidth: TITLE_MIN_WIDTH + (LEAD_COLUMNS - 1) * HOURS_WIDTH + weekCount * WEEK_WIDTH,
                    } }
                >
                    <colgroup>
                        <col />
                        { Array.from({ length: LEAD_COLUMNS - 1 }, (_, i) => (
                            <col key={ i } style={ { width: HOURS_WIDTH } } />
                        )) }
                        { timelineWeeks.map((week) => <col key={ week.id } style={ { width: WEEK_WIDTH } } />) }
                    </colgroup>
                    <TableHead
                        sx={ {
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                            "& th": { bgcolor: "background.paper", fontWeight: "bold" },
                        } }
                    >
                        <TableRow>
                            <TableCell>שם</TableCell>
                            <TableCell align="center">נדרש</TableCell>
                            <TableCell align="center">שובץ</TableCell>
                            { timelineWeeks.map((week) => (
                                <TableCell align="center" key={ week.id }>{ week.title }</TableCell>
                            )) }
                        </TableRow>
                        { ([
                            [ "זמן זמין", availableByWeek ],
                            [ "זמן משובץ", usedByWeek ],
                        ] as const).map(([ label, byWeek ]) => (
                            <TableRow key={ label }>
                                <TableCell colSpan={ LEAD_COLUMNS }>{ label }</TableCell>
                                { timelineWeeks.map((week, w) => (
                                    <TableCell
                                        align="center"
                                        key={ week.id }
                                        sx={ usedByWeek[ w ] > availableByWeek[ w ] ? errorTint : undefined }
                                    >
                                        { hours(byWeek[ w ]) }
                                    </TableCell>
                                )) }
                            </TableRow>
                        )) }
                    </TableHead>
                    <TableBody>
                        { rows.map((r, ri) =>
                        {
                            const allocated = r.weekMinutes.reduce((sum, m) => sum + m, 0);
                            const isSummary = r.kind !== "event";
                            const expanded = r.kind === "syllabus"
                                ? isSyllabusExpanded(r.id)
                                : r.kind === "module" && isModuleExpanded(r.id);
                            const conflict = allocated !== r.requiredMinutes;
                            const values = [
                                hours(r.requiredMinutes),
                                hours(allocated),
                                ...r.weekMinutes.map(hoursOrBlank),
                            ];
                            return (
                                <TableRow
                                    hover
                                    key={ `${r.kind}-${r.id}` }
                                    sx={ isSummary ? { bgcolor: r.kind === "syllabus" ? "action.selected" : "action.hover" } : undefined }
                                >
                                    <TableCell
                                        aria-selected={ ri === row && col === 0 }
                                        onClick={ () => setCursor({ row: ri, col: 0 }) }
                                        onDoubleClick={ () => activate(r) }
                                        ref={ ri === row && col === 0 ? selectedRef : undefined }
                                        sx={ cellSx(ri, 0, r.kind, r.depth) }
                                    >
                                        { isSummary ? (expanded ? <ExpandLess fontSize="inherit" /> : <ExpandMore fontSize="inherit" />) : null }
                                        { " " }{ r.title }
                                    </TableCell>
                                    { values.map((value, vi) => (
                                        <TableCell
                                            aria-selected={ ri === row && col === vi + 1 }
                                            key={ vi }
                                            onClick={ () => setCursor({ row: ri, col: vi + 1 }) }
                                            ref={ ri === row && col === vi + 1 ? selectedRef : undefined }
                                            sx={ {
                                                ...cellSx(ri, vi + 1, r.kind),
                                                ...(conflict && vi < LEAD_COLUMNS - 1 && errorTint),
                                            } }
                                            title={ conflict && vi < LEAD_COLUMNS - 1 ? "השיבוץ שונה מהנדרש" : undefined }
                                        >
                                            { value }
                                        </TableCell>
                                    )) }
                                </TableRow>
                            );
                        }) }
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};
