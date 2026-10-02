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

import { useCourses } from "@/components/base/CoursesProvider";
import {
    formatHours,
    getWeekTotalMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { buildStudentPaths } from "@/components/gantt/curriculum-view/student-load";
import { buildGridRows, CoursePresence, GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
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
const COURSE_WIDTH = 48;

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

/** Course cell fill: solid when the course attends all of the row, stripes when only some. */
const presenceSx = (presence: CoursePresence, color: string) =>
    presence === "full"
        ? { bgcolor: color }
        : presence === "partial"
            ? { backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 4px, transparent 4px 8px)` }
            : undefined;

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
    const { courses } = useCourses();

    // One column per leaf course, grouped under its parent below the root (e.g. Apollo › team A).
    const courseColumns = useMemo(() =>
    {
        const paths = buildStudentPaths(courses, courses.map((c) => c.id), true)
            .filter((path) => path.courseIds.length > 0);
        const byId = new Map(courses.map((c) => [ c.id, c ]));
        const columns = paths.map((path) =>
        {
            const named = path.courseIds.length > 1 ? path.courseIds.slice(1) : path.courseIds;
            const color = [ ...path.courseIds ].reverse().map((id) => byId.get(id)?.color).find(Boolean);
            return {
                path,
                group: named.length > 1 ? named[ 0 ] : null,
                name: byId.get(path.id)?.name ?? "",
                color: color ?? "#9e9e9e",
            };
        });
        // Header groups: consecutive columns sharing a parent.
        const groups: Array<{ id: null | string; name: string; span: number }> = [];
        for (const column of columns)
        {
            const last = groups.at(-1);
            if (column.group && last?.id === column.group) last.span++;
            else groups.push({ id: column.group, name: column.group ? byId.get(column.group)?.name ?? "" : column.name, span: 1 });
        }
        return { columns, groups };
    }, [ courses ]);
    const courseCount = courseColumns.columns.length;
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
            courseColumns.columns.map((c) => c.path),
        ),
        [ courseColumns,
            allLinearDays, curriculum?.syllabuses, curriculumMappings, dateOfDayId, eventSpans, exceptions,
            isModuleExpanded, isSyllabusExpanded, state, timelineWeeks, weekIndexByDayId,
        ],
    );

    // Syllabus rows are always present and sum everything under them (busiest shuffle, not every shuffle).
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
        if (target.kind === "syllabus" || target.kind === "shuffle") toggleSyllabus(target.key);
        else if (target.kind === "module") toggleModule(target.key);
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
                        // Theme divider is translucent; solid borders keep scrolled text from showing through.
                        "& th, & td": {
                            borderBottomColor: (theme: Theme) =>
                                theme.palette.grey[ theme.palette.mode === "dark" ? 800 : 300 ],
                        },
                        tableLayout: "fixed",
                        width: "100%",
                        minWidth: courseCount * COURSE_WIDTH + TITLE_MIN_WIDTH + (LEAD_COLUMNS - 1) * HOURS_WIDTH + weekCount * WEEK_WIDTH,
                    } }
                >
                    <colgroup>
                        { courseColumns.columns.map((c) => <col key={ c.path.id } style={ { width: COURSE_WIDTH } } />) }
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
                            { courseColumns.groups.map((g, i) => (
                                <TableCell
                                    align="center"
                                    colSpan={ g.span }
                                    key={ `${g.id}-${i}` }
                                    rowSpan={ g.id ? 1 : 3 }
                                    sx={ { fontSize: "0.75rem", px: 0.5 } }
                                >
                                    { g.name }
                                </TableCell>
                            )) }
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
                                { label === "זמן זמין" && courseColumns.columns.filter((c) => c.group).map((c) => (
                                    <TableCell
                                        align="center"
                                        key={ c.path.id }
                                        rowSpan={ 2 }
                                        sx={ { fontSize: "0.75rem", fontWeight: "normal", px: 0.5 } }
                                    >
                                        { c.name }
                                    </TableCell>
                                )) }
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
                            const expanded = r.kind === "module"
                                ? isModuleExpanded(r.key)
                                : isSummary && isSyllabusExpanded(r.key);
                            const conflict = allocated !== r.requiredMinutes;
                            const values = [
                                hours(r.requiredMinutes),
                                hours(allocated),
                                ...r.weekMinutes.map(hoursOrBlank),
                            ];
                            return (
                                <TableRow
                                    hover
                                    key={ `${r.kind}-${r.key}` }
                                    sx={ isSummary ? { bgcolor: r.kind === "module" ? "action.hover" : "action.selected" } : undefined }
                                >
                                    { courseColumns.columns.map((c, ci) => (
                                        <TableCell
                                            data-presence={ r.coursePresence[ ci ] }
                                            key={ c.path.id }
                                            sx={ presenceSx(r.coursePresence[ ci ], c.color) }
                                            title={ c.path.label }
                                        />
                                    )) }
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
