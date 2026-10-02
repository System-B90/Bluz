import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculumModuleDayMapping, GanttEventRecurrenceException } from "@/api-shared/types/gantt/models";
import { EventDaySpan } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { forEachRecurrenceOccurrence } from "@/components/gantt/curriculum-view/student-load";
import { countRequiredOccurrences } from "@/components/gantt/utils";

export type GridRow = {
    kind: "event" | "module" | "syllabus";
    id: string;
    syllabusId: string;
    moduleId: string;
    title: string;
    depth: number;
    requiredMinutes: number;
    weekMinutes: Array<number>;
};

export type GridPlacement = {
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
 * The grid's visible rows in display order. A summary row sums all of its
 * children, collapsed or not. An event's required time is its duration times
 * its required occurrences.
 */
export function buildGridRows(
    syllabusIds: Array<string>,
    placement: GridPlacement,
    isSyllabusExpanded: (id: string) => boolean,
    isModuleExpanded: (id: string) => boolean,
): Array<GridRow>
{
    const { state, weeks } = placement;
    const weekCount = weeks.length;
    const eventWeekMinutes = buildEventWeekMinutes(placement);
    const empty = new Array<number>(weekCount).fill(0);
    const out: Array<GridRow> = [];

    for (const syllabusId of syllabusIds)
    {
        const syllabus = state.syllabuses[ syllabusId ];
        if (!syllabus) continue;
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
                    requiredMinutes: (event.minimumDuration ?? 0)
                        * countRequiredOccurrences(event, eventId, state, placement),
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
                requiredMinutes: sumRequired(eventRows),
                weekMinutes: sumWeeks(eventRows, weekCount),
            };
            moduleRows.push(moduleRow);
            visible.push(moduleRow);
            if (isModuleExpanded(moduleId)) visible.push(...eventRows);
        }
        out.push({
            kind: "syllabus",
            id: syllabusId,
            syllabusId,
            moduleId: "",
            title: syllabus.title,
            depth: 0,
            requiredMinutes: sumRequired(moduleRows),
            weekMinutes: sumWeeks(moduleRows, weekCount),
        });
        if (isSyllabusExpanded(syllabusId)) out.push(...visible);
    }
    return out;
}
