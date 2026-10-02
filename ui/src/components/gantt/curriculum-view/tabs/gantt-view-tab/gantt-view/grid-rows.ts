import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculumModuleDayMapping, GanttEventRecurrenceException } from "@/api-shared/types/gantt/models";
import { isBreakEvent } from "@/api-shared/types/settings/meal";
import { EventDaySpan } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { forEachRecurrenceOccurrence, StudentPath } from "@/components/gantt/curriculum-view/student-load";
import { appliesToShuffle, countRequiredOccurrences } from "@/components/gantt/utils";

export type GridRow = {
    kind: "event" | "module" | "shuffle" | "syllabus";
    id: string;
    /** Unique per row: expansion-state key and React key. Shuffle sections repeat modules/events. */
    key: string;
    syllabusId: string;
    moduleId: string;
    title: string;
    depth: number;
    requiredMinutes: number;
    weekMinutes: Array<number>;
    /** Per course column: does that course attend all, some, or none of the row. */
    coursePresence: Array<CoursePresence>;
    /** Summary rows with nothing under them: there is nothing to expand. */
    childless?: boolean;
    /** Event rows in a shuffle section: that section's shuffle. */
    shuffle?: string;
    /** Event rows: every shuffle section the same event appears in (several ⇒ one event shared by all). */
    sharedShuffles?: Array<string>;
};

export type CoursePresence = "full" | "none" | "partial";

export type GridPlacement = {
    /** Leave break events out of the rows (and so every sum). */
    ignoreBreaks?: boolean;
    dateOf?: (dayId: string) => string | undefined;
    eventSpans: Record<string, EventDaySpan>;
    exceptions: Record<string, GanttEventRecurrenceException>;
    linearDays: Array<string>;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    state: NormalizedStore;
    weekIndexByDayId: Map<string, number>;
    /** Timeline weeks in order, each its day ids in order. */
    weeks: Array<Array<string>>;
};

const sumWeeks = (rows: Array<GridRow>, weekCount: number) =>
    Array.from({ length: weekCount }, (_, w) => rows.reduce((sum, row) => sum + row.weekMinutes[ w ], 0));

const sumRequired = (rows: Array<GridRow>) => rows.reduce((sum, row) => sum + row.requiredMinutes, 0);

/** Minutes each event takes per week: its placed parts plus every recurrence echo. */
export function buildEventWeekMinutes({
    dateOf,
    eventSpans,
    exceptions,
    linearDays,
    mappings,
    state,
    weekIndexByDayId,
    weeks,
}: GridPlacement): Map<string, Array<number>>
{
    const byEvent = new Map<string, Array<number>>();
    const add = (dayId: string, eventId: string, minutes: number) =>
    {
        const week = weekIndexByDayId.get(dayId);
        if (week === undefined) return;
        let perWeek = byEvent.get(eventId);
        if (!perWeek) byEvent.set(eventId, (perWeek = new Array<number>(weeks.length).fill(0)));
        perWeek[ week ] += minutes;
    };
    Object.entries(eventSpans).forEach(([ eventId, span ]) =>
        span.dayIds.forEach((dayId, i) => add(dayId, eventId, span.minutesPerDay[ i ])));
    forEachRecurrenceOccurrence({ dateOf, exceptions, linearDays, mappings, state }, add);
    return byEvent;
}

/**
 * Course columns each attending event: its own courses, else its syllabus'.
 * No (known) course means the whole syllabus or every student.
 */
const eventPresence = (courseIds: Array<string>, paths: Array<StudentPath>): Array<CoursePresence> =>
{
    const known = courseIds.filter((id) => paths.some((path) => path.courseIds.includes(id)));
    return paths.map((path) =>
        known.length === 0 || known.some((id) => path.courseIds.includes(id)) ? "full" : "none");
};

/** A summary attends fully when every child does, not at all when none do, else partially. */
const mergePresence = (rows: Array<GridRow>, columns: number): Array<CoursePresence> =>
    Array.from({ length: columns }, (_, c) =>
    {
        const seen = new Set(rows.map((row) => row.coursePresence[ c ]));
        if (seen.size === 0) return "none";
        return seen.size === 1 ? [ ...seen ][ 0 ] : "partial";
    });

/** Per-week max: parallel shuffles take the same student time, not their sum. */
const maxWeeks = (rows: Array<GridRow>, weekCount: number) =>
    Array.from({ length: weekCount }, (_, w) => Math.max(0, ...rows.map((row) => row.weekMinutes[ w ])));

/** Key of a row under a shuffle section, so each section collapses on its own. */
export const shuffleKey = (id: string, shuffle: string) => `${id}::${shuffle}`;

/**
 * The grid's visible rows in display order. A summary row sums all of its
 * children, collapsed or not. An event's required time is its duration times
 * its required occurrences. A syllabus with several shuffles gets one section
 * per shuffle ("Title (Shuffle)") holding only that shuffle's modules and
 * events; the syllabus row then shows the busiest shuffle, since students sit
 * in exactly one shuffle.
 */
export function buildGridRows(
    syllabusIds: Array<string>,
    placement: GridPlacement,
    isSyllabusExpanded: (key: string) => boolean,
    isModuleExpanded: (key: string) => boolean,
    /** Course columns, one per leaf course; none ⇒ no presence computed. */
    paths: Array<StudentPath> = [],
): Array<GridRow>
{
    const { state, weeks } = placement;
    const weekCount = weeks.length;
    const eventWeekMinutes = buildEventWeekMinutes(placement);
    const empty = new Array<number>(weekCount).fill(0);
    const out: Array<GridRow> = [];

    /** Module rows (and their visible events) of one syllabus, or one shuffle of it. */
    const moduleSection = (syllabusId: string, shuffle: null | string, depth: number) =>
    {
        const moduleRows: Array<GridRow> = [];
        const visible: Array<GridRow> = [];
        const syllabusPresence = eventPresence(state.syllabuses[ syllabusId ].courseIds ?? [], paths);
        for (const moduleId of state.syllabuses[ syllabusId ].modules)
        {
            const mod = state.modules[ moduleId ];
            if (!mod) continue;
            const eventRows: Array<GridRow> = mod.events.flatMap((eventId) =>
            {
                const event = state.events[ eventId ];
                if (!event) return [];
                if (placement.ignoreBreaks && isBreakEvent(state.syllabuses[ syllabusId ].title, event.title)) return [];
                // An event's own shuffle tags override its module's.
                const tags = event.shuffles?.length ? event.shuffles : mod.shuffles;
                if (shuffle !== null && !appliesToShuffle(tags, shuffle)) return [];
                const sharedShuffles = shuffle === null
                    ? undefined
                    : (state.syllabuses[ syllabusId ].shuffles ?? []).filter((name) => appliesToShuffle(tags, name));
                return [ {
                    kind: "event" as const,
                    id: eventId,
                    key: shuffle === null ? eventId : shuffleKey(eventId, shuffle),
                    syllabusId,
                    moduleId,
                    title: event.title,
                    shuffle: shuffle ?? undefined,
                    sharedShuffles,
                    depth: depth + 1,
                    requiredMinutes: (event.minimumDuration ?? 0)
                        * countRequiredOccurrences(event, eventId, state, placement),
                    weekMinutes: eventWeekMinutes.get(eventId) ?? empty,
                    coursePresence: event.courseIds?.length ? eventPresence(event.courseIds, paths) : syllabusPresence,
                } ];
            });
            if (shuffle !== null && eventRows.length === 0 && !appliesToShuffle(mod.shuffles, shuffle)) continue;
            const key = shuffle === null ? moduleId : shuffleKey(moduleId, shuffle);
            const moduleRow: GridRow = {
                kind: "module",
                id: moduleId,
                key,
                syllabusId,
                moduleId,
                title: mod.title,
                depth,
                requiredMinutes: sumRequired(eventRows),
                weekMinutes: sumWeeks(eventRows, weekCount),
                coursePresence: eventRows.length ? mergePresence(eventRows, paths.length) : syllabusPresence,
                childless: eventRows.length === 0,
            };
            moduleRows.push(moduleRow);
            visible.push(moduleRow);
            if (isModuleExpanded(key)) visible.push(...eventRows);
        }
        return { moduleRows, visible };
    };

    for (const syllabusId of syllabusIds)
    {
        const syllabus = state.syllabuses[ syllabusId ];
        if (!syllabus) continue;
        const shuffles = syllabus.shuffles ?? [];
        const base = { syllabusId, moduleId: "", key: syllabusId, id: syllabusId, title: syllabus.title };
        if (shuffles.length < 2)
        {
            const { moduleRows, visible } = moduleSection(syllabusId, null, 1);
            out.push({
                ...base,
                kind: "syllabus",
                depth: 0,
                requiredMinutes: sumRequired(moduleRows),
                weekMinutes: sumWeeks(moduleRows, weekCount),
                coursePresence: mergePresence(moduleRows, paths.length),
                childless: moduleRows.length === 0,
            });
            if (isSyllabusExpanded(syllabusId)) out.push(...visible);
            continue;
        }
        const sections = shuffles.map((shuffle) =>
        {
            const { moduleRows, visible } = moduleSection(syllabusId, shuffle, 2);
            const key = shuffleKey(syllabusId, shuffle);
            const row: GridRow = {
                ...base,
                kind: "shuffle",
                key,
                title: `${syllabus.title} (${shuffle})`,
                depth: 1,
                requiredMinutes: sumRequired(moduleRows),
                weekMinutes: sumWeeks(moduleRows, weekCount),
                coursePresence: mergePresence(moduleRows, paths.length),
                childless: moduleRows.length === 0,
            };
            return [ row, ...(isSyllabusExpanded(key) ? visible : []) ];
        });
        const shuffleRows = sections.map(([ row ]) => row);
        out.push({
            ...base,
            kind: "syllabus",
            depth: 0,
            requiredMinutes: Math.max(...shuffleRows.map((r) => r.requiredMinutes)),
            weekMinutes: maxWeeks(shuffleRows, weekCount),
            coursePresence: mergePresence(shuffleRows, paths.length),
        });
        if (isSyllabusExpanded(syllabusId)) out.push(...sections.flat());
    }
    return out;
}
