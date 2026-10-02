import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { forEachRecurrenceOccurrence } from "@/components/gantt/curriculum-view/student-load";
import { GanttViewProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/UseGanttView";
import { useCurriculumProviderActions, useCurriculumState } from "@/components/gantt/state/context";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

type GridRow = {
    kind: "event" | "module" | "syllabus";
    id: string;
    syllabusId: string;
    moduleId: string;
    title: string;
    depth: number;
    requiredMinutes: number;
    weekMinutes: Array<number>;
};

/** Leading columns before the weeks: title, required, allocated. */
const LEAD_COLUMNS = 3;

const sumWeeks = (rows: Array<GridRow>, weekCount: number) =>
    Array.from({ length: weekCount }, (_, w) => rows.reduce((sum, row) => sum + row.weekMinutes[ w ], 0));

const hoursOrBlank = (minutes: number) => (minutes ? formatHours(minutes) : "");

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

    // Minutes each event takes per week: its placed parts plus every echo.
    const eventWeekMinutes = useMemo(() =>
    {
        const byEvent = new Map<string, Array<number>>();
        const add = (dayId: string, eventId: string, minutes: number) =>
        {
            const week = weekIndexByDayId.get(dayId);
            if (week === undefined) return;
            let weeks = byEvent.get(eventId);
            if (!weeks) byEvent.set(eventId, (weeks = new Array<number>(weekCount).fill(0)));
            weeks[ week ] += minutes;
        };
        Object.entries(eventSpans).forEach(([ eventId, span ]) =>
            span.dayIds.forEach((dayId, i) => add(dayId, eventId, span.minutesPerDay[ i ])));
        forEachRecurrenceOccurrence(
            { dateOf: dateOfDayId, exceptions, linearDays: allLinearDays, mappings: curriculumMappings, state },
            add,
        );
        return byEvent;
    }, [ allLinearDays, curriculumMappings, dateOfDayId, eventSpans, exceptions, state, weekCount, weekIndexByDayId ]);

    // Visible rows in display order; a summary row sums all of its children,
    // collapsed or not.
    const rows = useMemo(() =>
    {
        const out: Array<GridRow> = [];
        const empty = new Array<number>(weekCount).fill(0);
        for (const syllabusId of curriculum?.syllabuses ?? [])
        {
            const syllabus = state.syllabuses[ syllabusId ];
            if (!syllabus) continue;
            const syllabusRow: GridRow = {
                kind: "syllabus",
                id: syllabusId,
                syllabusId,
                moduleId: "",
                title: syllabus.title,
                depth: 0,
                requiredMinutes: 0,
                weekMinutes: empty,
            };
            const moduleRows: Array<GridRow> = [];
            const visible: Array<GridRow> = [];
            for (const moduleId of syllabus.modules)
            {
                const mod = state.modules[ moduleId ];
                if (!mod) continue;
                const eventRows: Array<GridRow> = mod.events.flatMap((eventId) =>
                {
                    const event = state.events[ eventId ];
                    return event ? [ {
                        kind: "event" as const,
                        id: eventId,
                        syllabusId,
                        moduleId,
                        title: event.title,
                        depth: 2,
                        requiredMinutes: event.minimumDuration ?? 0,
                        weekMinutes: eventWeekMinutes.get(eventId) ?? empty,
                    } ] : [];
                });
                const moduleRow: GridRow = {
                    kind: "module",
                    id: moduleId,
                    syllabusId,
                    moduleId,
                    title: mod.title,
                    depth: 1,
                    requiredMinutes: eventRows.reduce((sum, row) => sum + row.requiredMinutes, 0),
                    weekMinutes: sumWeeks(eventRows, weekCount),
                };
                moduleRows.push(moduleRow);
                visible.push(moduleRow);
                if (isModuleExpanded(moduleId)) visible.push(...eventRows);
            }
            syllabusRow.requiredMinutes = moduleRows.reduce((sum, row) => sum + row.requiredMinutes, 0);
            syllabusRow.weekMinutes = sumWeeks(moduleRows, weekCount);
            out.push(syllabusRow);
            if (isSyllabusExpanded(syllabusId)) out.push(...visible);
        }
        return out;
    }, [ curriculum?.syllabuses, eventWeekMinutes, isModuleExpanded, isSyllabusExpanded, state, weekCount ]);

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
        whiteSpace: "nowrap",
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
                <Table size="small" stickyHeader sx={ { width: "max-content", minWidth: "100%" } }>
                    <TableHead>
                        <TableRow>
                            <TableCell>שם</TableCell>
                            <TableCell align="center">נדרש</TableCell>
                            <TableCell align="center">שובץ</TableCell>
                            { timelineWeeks.map((week) => (
                                <TableCell align="center" key={ week.id }>{ week.title }</TableCell>
                            )) }
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        { rows.map((r, ri) =>
                        {
                            const allocated = r.weekMinutes.reduce((sum, m) => sum + m, 0);
                            const isSummary = r.kind !== "event";
                            const expanded = r.kind === "syllabus"
                                ? isSyllabusExpanded(r.id)
                                : r.kind === "module" && isModuleExpanded(r.id);
                            const values = [
                                formatHours(r.requiredMinutes),
                                formatHours(allocated),
                                ...r.weekMinutes.map(hoursOrBlank),
                            ];
                            return (
                                <TableRow
                                    hover
                                    key={ `${r.kind}-${r.id}` }
                                    sx={ isSummary ? { bgcolor: r.kind === "syllabus" ? "action.selected" : "action.hover" } : undefined }
                                >
                                    <TableCell
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
                                            key={ vi }
                                            onClick={ () => setCursor({ row: ri, col: vi + 1 }) }
                                            ref={ ri === row && col === vi + 1 ? selectedRef : undefined }
                                            sx={ cellSx(ri, vi + 1, r.kind) }
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
