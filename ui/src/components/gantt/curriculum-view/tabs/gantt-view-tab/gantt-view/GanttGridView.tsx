import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Remove from "@mui/icons-material/Remove";
import Box from "@mui/material/Box";
import InputBase from "@mui/material/InputBase";
import Paper from "@mui/material/Paper";
import { alpha, keyframes, Theme } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCourses } from "@/components/base/CoursesProvider";
import {
    formatHours,
    getWeekTotalMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { buildStudentPaths, sumStudentMinutes, withoutBreaks } from "@/components/gantt/curriculum-view/student-load";
import { parseHoursInput, ZeroChoice } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-allotment";
import { onGridExpansionRequest, publishGridAllCollapsed } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-expansion-bus";
import { useGridAnimation, useGridCompactHeader, useGridIgnoreBreaks, useGridVerticalLines } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-preferences";
import { buildGridRows, CoursePresence, GridRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-rows";
import { initialSelection, isCellSelected, selectCell } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-selection";
import { GridContextMenu } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GridContextMenu";
import { HoursCourseSelect, useHoursPathId } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/HoursCourseSelect";
import { mergeRowTransitions, RowPhase, TransitionRow } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/row-transitions";
import { GanttViewProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGridAllotment } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-allotment";
import { useGridContextMenu } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-grid-context-menu";
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

const ROW_ANIMATION_MS = 180;
const rowId = (row: GridRow) => `${row.kind}-${row.key}`;
/** A row squeezed shut: no height, invisible. */
const squeezed = { opacity: 0, paddingBlock: 0, lineHeight: 0, fontSize: 0, borderBottomWidth: 0 };
const growIn = keyframes({ from: squeezed });
const shrinkOut = keyframes({ to: squeezed });
const phaseSx = (phase: RowPhase) =>
    phase === "stay"
        ? undefined
        : {
            pointerEvents: phase === "exit" ? "none" : undefined,
            "& > td": { animation: `${phase === "enter" ? growIn : shrinkOut} ${ROW_ANIMATION_MS}ms ease-out forwards` },
            "@media (prefers-reduced-motion: reduce)": { "& > td": { animation: "none" }, display: phase === "exit" ? "none" : undefined },
        };

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

/** Selected-cell overlay: an inset shadow tints over any background, error tint included. */
const selectedSx = {
    boxShadow: (theme: Theme) => `inset 0 0 0 100vmax ${alpha(theme.palette.primary.main, 0.16)}`,
};

/** Course cell fill: solid when the course attends all of the row, stripes when only some. */
const presenceSx = (presence: CoursePresence, color: string) =>
    presence === "full"
        ? { bgcolor: color }
        : presence === "partial"
            ? { backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 4px, transparent 4px 8px)` }
            : undefined;

/**
 * Spreadsheet-style gantt: weeks as columns, events as rows, each cell the
 * hours the event takes that week (recurrence echoes and week splits
 * included). Syllabus/module summary rows sum their children and collapse.
 * Arrow keys move the selected cell; Shift+arrows/click select a range,
 * Ctrl+click adds or removes a cell. Enter opens the row's dialog; Space
 * toggles a summary row; + expands and - collapses it. An event's week cells are editable (type, Enter, F2 or
 * double-click; Delete clears): the value is allotted to that week on blur.
 */
export const GanttGridView: React.FC<GanttViewProps> = ({ curriculumId }) =>
{
    const state = useCurriculumState();
    const { openEventDialog, openModuleDialog, openSyllabusDialog } = useCurriculumProviderActions();
    const { state: { exceptions } } = useGanttRecurrenceExceptions();
    const { curriculum, contextValue } = useGanttView(curriculumId);
    const {
        allLinearDays,
        curriculumMappings,
        dateOfDayId,
        eventSpans,
        isModuleExpanded,
        isSyllabusExpanded,
        setAllRows,
        studentLoadByDay,
        studentLoadWithBreaksByDay,
        studentPaths,
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
    const ignoreBreaks = useGridIgnoreBreaks();

    const build = useCallback(
        (syllabusOpen: (key: string) => boolean, moduleOpen: (key: string) => boolean) => buildGridRows(
            curriculum?.syllabuses ?? [],
            {
                dateOf: dateOfDayId,
                eventSpans,
                exceptions,
                ignoreBreaks,
                linearDays: allLinearDays,
                mappings: curriculumMappings,
                state,
                weekIndexByDayId,
                weeks: timelineWeeks.map((week) => week.days),
            },
            syllabusOpen,
            moduleOpen,
            courseColumns.columns.map((c) => c.path),
        ),
        [ courseColumns,
            allLinearDays, curriculum?.syllabuses, ignoreBreaks, curriculumMappings, dateOfDayId, eventSpans, exceptions,
            state, timelineWeeks, weekIndexByDayId,
        ],
    );
    const rows = useMemo(
        () => build(isSyllabusExpanded, isModuleExpanded),
        [ build, isModuleExpanded, isSyllabusExpanded ],
    );

    // Toolbar "collapse/expand all": every key comes from a fully opened build of the tree.
    useEffect(() => onGridExpansionRequest((command) =>
    {
        const all = build(() => true, () => true);
        const keysOf = (...kinds: Array<GridRow["kind"]>) => all.filter((r) => kinds.includes(r.kind)).map((r) => r.key);
        setAllRows(command === "expand", keysOf("syllabus", "shuffle"), keysOf("module"));
    }), [ build, setAllRows ]);
    // Nothing below the syllabus rows is showing: the button should offer to expand.
    const nothingOpen = rows.length > 0 && rows.every((r) => r.kind === "syllabus");
    useEffect(() =>
    {
        publishGridAllCollapsed(nothingOpen);
    }, [ nothingOpen ]);

    // Collapse/expand: vanished rows linger as `exit` and new ones play `enter` for one animation.
    // Compared by identity of the row list's content, since `rows` is rebuilt on every state change.
    const animated = useGridAnimation();
    const verticalLines = useGridVerticalLines();
    const compactHeader = useGridCompactHeader();
    const signature = rows.map(rowId).join("|");
    const stay = (list: Array<GridRow>) => list.map((row) => ({ row, phase: "stay" as const }));
    const [ shown, setShown ] = useState<{ signature: string; items: Array<TransitionRow> }>(
        () => ({ signature, items: stay(rows) }),
    );
    if (shown.signature !== signature)
    {
        const previous = shown.items.filter((item) => item.phase !== "exit").map((item) => item.row);
        const animate = animated && previous.length > 0 && rows.length > 0;
        setShown({ signature, items: animate ? mergeRowTransitions(previous, rows) : stay(rows) });
    }
    const settling = shown.items.some((item) => item.phase !== "stay");
    useEffect(() =>
    {
        if (!settling) return;
        const timer = setTimeout(
            () => setShown((prev) => ({ ...prev, items: prev.items.filter((i) => i.phase !== "exit").map((i) => ({ ...i, phase: "stay" as const })) })),
            ROW_ANIMATION_MS + 20,
        );
        return () => clearTimeout(timer);
    }, [ settling, shown.signature ]);
    // Show current data for live rows; exiting ones keep their last snapshot.
    const rowById = new Map(rows.map((r) => [ rowId(r), r ]));
    const displayItems = shown.items.map((item) =>
        (item.phase === "exit" ? item : { ...item, row: rowById.get(rowId(item.row)) ?? item.row }));
    const rowIndex = new Map(rows.map((r, i) => [ rowId(r), i ]));

    // One student's week, as on the timeline: the chosen course's, else the busiest course's (#899).
    // Summing the syllabus rows instead added up courses no student attends together.
    const hoursPathId = useHoursPathId(studentPaths);
    const studentLoads = useMemo(
        () => (ignoreBreaks ? withoutBreaks(studentLoadWithBreaksByDay) : studentLoadWithBreaksByDay),
        [ ignoreBreaks, studentLoadWithBreaksByDay ],
    );
    const usedByWeek = timelineWeeks.map((week) => sumStudentMinutes(studentLoads, week.days, hoursPathId));
    // Weeks where an event keeps a mapping, so a kept 0 reads "0" rather than looking removed.
    const placedWeeks = useMemo(() =>
    {
        const placed = new Set<string>();
        for (const m of Object.values(curriculumMappings))
        {
            const week = weekIndexByDayId.get(m.dayId);
            if (m.eventId && week !== undefined) placed.add(`${m.eventId}:${week}`);
        }
        return placed;
    }, [ curriculumMappings, weekIndexByDayId ]);
    // Like the timeline, ignoring breaks also takes each day's break time out of the available hours.
    const availableByWeek = timelineWeeks.map((week) => getWeekTotalMinutes(week, state)
        - (ignoreBreaks ? week.days.reduce((sum, dayId) => sum + (studentLoadByDay[ dayId ]?.breakMinutes ?? 0), 0) : 0));

    const [ selection, setSelection ] = useState(initialSelection);
    const row = Math.min(selection.cursor.row, rows.length - 1);
    // Course columns sit before the title at negative indexes, so the title stays column 0.
    const col = Math.max(-courseCount, Math.min(selection.cursor.col, LEAD_COLUMNS + weekCount - 1));
    const select = (cell: { row: number; col: number }, mode: { shift?: boolean; ctrl?: boolean } = {}) =>
        setSelection((prev) => selectCell(prev, cell, mode));
    const clickMode = (e: React.MouseEvent) => ({ shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
    const selectedRef = useRef<HTMLTableCellElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const { enqueueSnackbar } = useSnackbar();

    const { commitWeek, splitShuffles, dialog } = useGridAllotment({
        curriculumId,
        dateOf: dateOfDayId,
        exceptions,
        linearDays: allLinearDays,
        mappings: curriculumMappings,
        state,
        weeks: timelineWeeks.map((week) => week.days),
    });
    // Only an event's week cells hold editable time; sums, titles and headers don't.
    const isEditable = (r: number, c: number) => rows[ r ]?.kind === "event" && c >= LEAD_COLUMNS;
    const [ editing, setEditing ] = useState<{ row: number; col: number; text: string } | null>(null);
    const startEdit = (r: number, c: number, text?: string) =>
    {
        if (!isEditable(r, c)) return;
        const minutes = rows[ r ].weekMinutes[ c - LEAD_COLUMNS ];
        setEditing({ row: r, col: c, text: text ?? hoursOrBlank(minutes) });
    };
    // Escape refocuses the grid, which blurs the input: that blur must not commit.
    const cancelledRef = useRef(false);
    const commitEdit = (text: string, target: { row: number; col: number }) =>
    {
        setEditing(null);
        gridRef.current?.focus();
        if (cancelledRef.current)
        {
            cancelledRef.current = false;
            return;
        }
        const minutes = parseHoursInput(text);
        if (minutes === null)
        {
            enqueueSnackbar("ערך שעות לא תקין", { variant: "error" });
            return;
        }
        void writeWeek(target, minutes);
    };
    /** Writes one week cell; `zero` pre-answers keep-0 vs remove (the right-click entries, #858). */
    const writeWeek = async (target: { row: number; col: number }, minutes: number, zero?: ZeroChoice) =>
    {
        const r = rows[ target.row ];
        if (!r || !isEditable(target.row, target.col)) return;
        const week = target.col - LEAD_COLUMNS;
        if (!zero && minutes === r.weekMinutes[ week ]) return;
        const shared = sharedOf(r);
        if (zero) await commitWeek(r.id, r.moduleId, week, minutes, shared, zero);
        else if (shared) await commitWeek(r.id, r.moduleId, week, minutes, shared);
        else await commitWeek(r.id, r.moduleId, week, minutes);
    };
    const sharedOf = (r: GridRow) => (r.shuffle && (r.sharedShuffles?.length ?? 0) > 1
        ? { shuffle: r.shuffle, shuffles: r.sharedShuffles ?? [] }
        : undefined);

    useEffect(() =>
    {
        selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [ row, col ]);

    /** Space/double-click: summary rows collapse or expand, events open their dialog. */
    const activate = (target: GridRow) =>
    {
        if (target.kind === "syllabus" || target.kind === "shuffle") toggleSyllabus(target.key);
        else if (target.kind === "module") toggleModule(target.key);
        else openEventDialog(target.syllabusId, target.moduleId, target.id);
    };
    /** Enter: every row opens its own dialog. */
    const openDialog = (target: GridRow) =>
    {
        if (target.kind === "syllabus" || target.kind === "shuffle") openSyllabusDialog(target.syllabusId);
        else if (target.kind === "module") openModuleDialog(target.syllabusId, target.moduleId);
        else openEventDialog(target.syllabusId, target.moduleId, target.id);
    };
    /** +/-: set a summary row open or closed (a no-op when it already is). */
    const setExpanded = (target: GridRow, open: boolean) =>
    {
        if (target.kind === "event") return;
        const isOpen = target.kind === "module" ? isModuleExpanded(target.key) : isSyllabusExpanded(target.key);
        if (isOpen !== open) activate(target);
    };

    /* ── Right-click menu (#858) ── */

    const { menu, openMenu, closeMenu, runMenuAction, setRange } = useGridContextMenu({
        rows,
        allRows: () => build(() => true, () => true),
        events: state.events,
        leadColumns: LEAD_COLUMNS,
        selection,
        select,
        isEditable,
        placedWeeks,
        isModuleExpanded,
        isSyllabusExpanded,
        sharedOf,
        openDialog,
        setExpanded,
        startEdit,
        writeWeek,
        splitShuffles,
    });

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
        if (isEditable(row, col) && (e.key === "Enter" || e.key === "F2"))
        {
            e.preventDefault();
            startEdit(row, col);
        }
        else if (isEditable(row, col) && (e.key === "Delete" || e.key === "Backspace"))
        {
            e.preventDefault();
            commitEdit("", { row, col });
        }
        else if (isEditable(row, col) && !e.ctrlKey && !e.metaKey && /^[\d.:]$/.test(e.key))
        {
            e.preventDefault();
            startEdit(row, col, e.key);
        }
        else if (move)
        {
            e.preventDefault();
            const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
            select({
                row: clamp(row + move[ 0 ], 0, rows.length - 1),
                col: clamp(col + move[ 1 ], -courseCount, LEAD_COLUMNS + weekCount - 1),
            }, { shift: e.shiftKey });
        }
        else if (e.key === "Enter" && rows[ row ])
        {
            e.preventDefault();
            openDialog(rows[ row ]);
        }
        else if (e.key === " " && rows[ row ])
        {
            e.preventDefault();
            activate(rows[ row ]);
        }
        else if ((e.key === "+" || e.key === "=" || e.key === "-") && rows[ row ])
        {
            e.preventDefault();
            setExpanded(rows[ row ], e.key !== "-");
        }
    };

    if (!curriculum) return <Typography sx={ { p: 2 } }>טוען גאנט...</Typography>;

    const cellSx = (r: number, c: number, kind: GridRow["kind"], depth = 0) => ({
        paddingInlineStart: c === 0 ? 1 + depth * 2 : 1,
        fontVariantNumeric: "tabular-nums",
        fontWeight: kind === "event" ? "normal" : "bold",
        overflowWrap: "anywhere",
        textAlign: c === 0 ? "start" : "center",
        // Shift+click selects cells, not text.
        userSelect: "none",
        outline: r === row && c === col ? "2px solid" : "none",
        outlineColor: "primary.main",
        outlineOffset: -2,
        ...(isCellSelected(selection, { row: r, col: c }) && selectedSx),
    });

    return (
        <Paper elevation={ 0 } sx={ { mt: 2, width: "100%", overflow: "hidden" } }>
            <TableContainer
                aria-label="טבלת גאנט"
                onKeyDown={ handleKeyDown }
                ref={ gridRef }
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
                            // Faint column separators, drawn on the cell so sticky cells carry them along.
                            ...(verticalLines && {
                                borderInlineEnd: "1px solid",
                                borderInlineEndColor: (theme: Theme) =>
                                    alpha(theme.palette.grey[ theme.palette.mode === "dark" ? 700 : 400 ], 0.25),
                            }),
                        },
                        // Collapsed borders belong to the table, not the sticky header cells, so they scroll
                        // away and leave the header see-through; separate borders travel with each cell.
                        borderCollapse: "separate",
                        borderSpacing: 0,
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
                                    rowSpan={ g.id ? 1 : compactHeader ? 2 : 3 }
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
                            ...(compactHeader
                                ? [ [ "משובץ / זמין", usedByWeek, availableByWeek ] as const ]
                                : [ [ "זמן זמין", availableByWeek ] as const, [ "זמן משובץ", usedByWeek ] as const ]),
                        ]).map(([ label, byWeek, against ], rowNumber) => (
                            <TableRow key={ label }>
                                { rowNumber === 0 && courseColumns.columns.filter((c) => c.group).map((c) => (
                                    <TableCell
                                        align="center"
                                        key={ c.path.id }
                                        rowSpan={ compactHeader ? 1 : 2 }
                                        sx={ { fontSize: "0.75rem", fontWeight: "normal", px: 0.5 } }
                                    >
                                        { c.name }
                                    </TableCell>
                                )) }
                                <TableCell colSpan={ LEAD_COLUMNS }>
                                    { byWeek === usedByWeek ? (
                                        <Box alignItems="center" display="flex" gap={ 1 } justifyContent="space-between">
                                            { label }
                                            <HoursCourseSelect paths={ studentPaths } />
                                        </Box>
                                    ) : label }
                                </TableCell>
                                { timelineWeeks.map((week, w) => (
                                    <TableCell
                                        align="center"
                                        key={ week.id }
                                        sx={ usedByWeek[ w ] > availableByWeek[ w ] ? errorTint : undefined }
                                    >
                                        { against ? `${hours(byWeek[ w ])} / ${hours(against[ w ])}` : hours(byWeek[ w ]) }
                                    </TableCell>
                                )) }
                            </TableRow>
                        )) }
                    </TableHead>
                    <TableBody>
                        { displayItems.map(({ row: r, phase }) =>
                        {
                            const ri = phase === "exit" ? -1 : rowIndex.get(rowId(r)) ?? -1;
                            const allocated = r.weekMinutes.reduce((sum, m) => sum + m, 0);
                            const isSummary = r.kind !== "event";
                            const expanded = r.kind === "module"
                                ? isModuleExpanded(r.key)
                                : isSummary && isSyllabusExpanded(r.key);
                            const conflict = allocated !== r.requiredMinutes;
                            const values = [
                                hours(r.requiredMinutes),
                                hours(allocated),
                                ...r.weekMinutes.map((minutes, w) =>
                                    minutes === 0 && r.kind === "event" && placedWeeks.has(`${r.id}:${w}`) ? hours(0) : hoursOrBlank(minutes)),
                            ];
                            return (
                                <TableRow
                                    hover
                                    key={ rowId(r) }
                                    // Anywhere on a summary row (name cell included) collapses or expands it.
                                    onDoubleClick={ isSummary ? () => activate(r) : undefined }
                                    sx={ {
                                        ...phaseSx(phase),
                                        ...(isSummary && { bgcolor: r.kind === "module" ? "action.hover" : "action.selected" }),
                                        // Blue, not the theme's gray hover: gray is the module row's own fill.
                                        "&.MuiTableRow-hover:hover": { bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.14) },
                                    } }
                                >
                                    { courseColumns.columns.map((c, ci) =>
                                    {
                                        const cc = ci - courseCount;
                                        return (
                                            <TableCell
                                                aria-current={ ri === row && col === cc ? "true" : undefined }
                                                aria-selected={ isCellSelected(selection, { row: ri, col: cc }) }
                                                data-presence={ r.coursePresence[ ci ] }
                                                key={ c.path.id }
                                                onClick={ (e) => select({ row: ri, col: cc }, clickMode(e)) }
                                                onContextMenu={ (e) => openMenu(e, { row: ri, col: cc }) }
                                                ref={ ri === row && col === cc ? selectedRef : undefined }
                                                // The 1/0 value is data only: transparent text.
                                                sx={ { ...cellSx(ri, cc, "event"), ...(presenceSx(r.coursePresence[ ci ], c.color) as object), color: "transparent" } }
                                                title={ c.path.label }
                                            >
                                                { r.coursePresence[ ci ] === "none" ? 0 : 1 }
                                            </TableCell>
                                        );
                                    }) }
                                    <TableCell
                                        aria-current={ ri === row && col === 0 ? "true" : undefined }
                                        aria-selected={ isCellSelected(selection, { row: ri, col: 0 }) }
                                        onClick={ (e) => select({ row: ri, col: 0 }, clickMode(e)) }
                                        onContextMenu={ (e) => openMenu(e, { row: ri, col: 0 }) }
                                        onDoubleClick={ isSummary ? undefined : () => activate(r) }
                                        ref={ ri === row && col === 0 ? selectedRef : undefined }
                                        sx={ cellSx(ri, 0, r.kind, r.depth) }
                                    >
                                        { isSummary ? (r.childless ? <Remove fontSize="inherit" /> : expanded ? <ExpandLess fontSize="inherit" /> : <ExpandMore fontSize="inherit" />) : null }
                                        { " " }{ r.title }
                                    </TableCell>
                                    { values.map((value, vi) => (
                                        <TableCell
                                            aria-current={ ri === row && col === vi + 1 ? "true" : undefined }
                                            aria-readonly={ isEditable(ri, vi + 1) ? undefined : true }
                                            aria-selected={ isCellSelected(selection, { row: ri, col: vi + 1 }) }
                                            key={ vi }
                                            onClick={ (e) => select({ row: ri, col: vi + 1 }, clickMode(e)) }
                                            onContextMenu={ (e) => openMenu(e, { row: ri, col: vi + 1 }) }
                                            onDoubleClick={ () => startEdit(ri, vi + 1) }
                                            ref={ ri === row && col === vi + 1 ? selectedRef : undefined }
                                            sx={ {
                                                ...cellSx(ri, vi + 1, r.kind),
                                                ...(conflict && vi < LEAD_COLUMNS - 1 && errorTint),
                                            } }
                                            title={ conflict && vi < LEAD_COLUMNS - 1 ? "השיבוץ שונה מהנדרש" : undefined }
                                        >
                                            { editing?.row === ri && editing.col === vi + 1 ? (
                                                <InputBase
                                                    autoFocus
                                                    inputProps={ { "aria-label": "שעות בשבוע", dir: "ltr", style: { textAlign: "center", padding: 0 } } }
                                                    onBlur={ (e) => commitEdit(e.target.value, editing) }
                                                    onChange={ (e) => setEditing({ ...editing, text: e.target.value }) }
                                                    onFocus={ (e) => e.target.select() }
                                                    onKeyDown={ (e) =>
                                                    {
                                                        e.stopPropagation();
                                                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                        else if (e.key === "Escape")
                                                        {
                                                            cancelledRef.current = true;
                                                            (e.target as HTMLInputElement).blur();
                                                        }
                                                    } }
                                                    sx={ { fontSize: "inherit", width: "100%" } }
                                                    value={ editing.text }
                                                />
                                            ) : value }
                                        </TableCell>
                                    )) }
                                </TableRow>
                            );
                        }) }
                    </TableBody>
                </Table>
            </TableContainer>
            { dialog }
            <GridContextMenu
                onAction={ runMenuAction }
                onClose={ closeMenu }
                onSetRange={ (text) => void setRange(text) }
                target={ menu }
            />
        </Paper>
    );
};
