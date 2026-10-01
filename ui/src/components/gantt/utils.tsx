import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import {
    EventRecurrence,
    GanttCurriculumModuleDayMapping,
    GanttEvent,
    GanttEventRecurrenceException,
    GanttModule,
    GanttSyllabus,
    getAllowedDayIndices,
} from "@/api-shared/types/gantt/models";

type NumberFieldKeys<T> = {
    [K in keyof T]-?: T[K] extends null | number | undefined ? K : never;
}[keyof T];

/**
 * True when an item (module/event) applies to the given shuffle.
 * An empty/undefined shuffle list means "applies to all shuffles".
 */
export function appliesToShuffle(
    itemShuffles: Array<string> | undefined,
    shuffle: string,
): boolean {
    return (
        !itemShuffles ||
        itemShuffles.length === 0 ||
        itemShuffles.includes(shuffle)
    );
}

/**
 * Placement/exception data needed to count how many times a recurring event
 * actually occurs on the timeline. Omitted ⇒ every event counts once,
 * matching the pre-recurrence-aware behavior (e.g. before placement exists).
 */
export type RecurrenceOccurrenceContext = {
    // Same shape as GanttMappingState.mappings / GanttRecurrenceExceptionState.exceptions.
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    exceptions: Record<string, GanttEventRecurrenceException>;
    /** Timeline day ids in chronological order. */
    linearDays: Array<string>;
    /** Count only occurrences on these days (e.g. one week); unplaced events count 0. */
    onlyDayIds?: ReadonlySet<string>;
};

/**
 * Number of times an event occurs on the timeline: 1 for a non-recurring or
 * unplaced event, otherwise 1 (its mapped start day) plus every surviving
 * echoed occurrence — skipping days recorded as recurrence exceptions (#111).
 */
export function countEventOccurrences(
    event: GanttEvent,
    eventId: string,
    state: NormalizedStore,
    ctx?: RecurrenceOccurrenceContext,
): number {
    if (!ctx || (event.recurrence === EventRecurrence.None && !ctx.onlyDayIds)) return 1;

    let startDayId: string | undefined;
    for (const mapping of Object.values(ctx.mappings)) {
        if (mapping.eventId === eventId) {
            startDayId = mapping.dayId;
            break;
        }
    }
    if (!startDayId) return ctx.onlyDayIds ? 0 : 1;
    if (event.recurrence === EventRecurrence.None) return ctx.onlyDayIds?.has(startDayId) ? 1 : 0;

    const excludedDayIds = new Set<string>();
    for (const exception of Object.values(ctx.exceptions)) {
        if (exception.eventId === eventId) excludedDayIds.add(exception.dayId);
    }

    const echoDayIds = getRecurrenceOccurrenceDayIds({
        recurrence: event.recurrence,
        startDayId,
        linearDays: ctx.linearDays,
        dayIndexOf: (dayId) => state.days[dayId]?.dayIndex,
        excludedDayIds,
        recurrenceStartDate: event.recurrenceStartDate,
        recurrenceEndDate: event.recurrenceEndDate,
        allowedDayIndices: getAllowedDayIndices(event.constraints),
    });

    const { onlyDayIds } = ctx;
    const inScope = (dayId: string) => !onlyDayIds || onlyDayIds.has(dayId);
    return (excludedDayIds.has(startDayId) || !inScope(startDayId) ? 0 : 1)
        + [...echoDayIds].filter(inScope).length;
}

function calculateSumValueForModuleByField(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    shuffle?: string,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    // Events sharing a groupId are one lesson held once per shuffle, so the
    // module costs the longest member - not the sum of all of them (#699). No
    // shuffle sits through more than one member, so summing would inflate every
    // grouped lesson by the number of shuffles it covers.
    const groupMaxima = new Map<string, number>();
    let total = 0;

    for (const eventId of module.events ?? []) {
        const event = state.events[eventId];
        if (!event) continue;
        if (shuffle !== undefined && !appliesToShuffle(event.shuffles, shuffle)) {
            continue;
        }
        // Shuffles don't apply to an event limited to some courses: it runs
        // for its courses only and is compared between courses instead.
        if (shuffle !== undefined && (event.courseIds ?? []).length > 0) continue;

        const occurrences = countEventOccurrences(
            event,
            eventId,
            state,
            occurrenceCtx,
        );
        const value = (event[fieldName] ?? 0) * occurrences;

        if (!event.groupId) {
            total += value;
            continue;
        }
        groupMaxima.set(
            event.groupId,
            Math.max(groupMaxima.get(event.groupId) ?? 0, value),
        );
    }

    for (const groupMax of groupMaxima.values()) total += groupMax;

    return total;
}

/** True when per-shuffle totals are unequal (⇒ shuffles get different time). */
export function doShuffleTotalsDiffer(
    totals: null | Record<string, number>,
): boolean {
    if (!totals) return false;
    return new Set(Object.values(totals)).size > 1;
}

/**
 * Per-shuffle sums of an event field across a whole syllabus, or null when
 * neither the syllabus nor its modules/events are shuffle-tagged.
 */
export function getSyllabusShuffleTotals(
    syllabus: GanttSyllabus,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): null | Record<string, number> {
    const names = new Set<string>(syllabus.shuffles ?? []);
    for (const moduleId of syllabus.modules ?? []) {
        const moduleDoc = state.modules[moduleId];
        if (!moduleDoc) continue;
        for (const s of moduleDoc.shuffles ?? []) names.add(s);
        for (const eventId of moduleDoc.events ?? []) {
            for (const s of state.events[eventId]?.shuffles ?? []) {
                names.add(s);
            }
        }
    }
    if (names.size === 0) return null;

    const totals: Record<string, number> = {};
    for (const name of names) {
        totals[name] = (syllabus.modules ?? []).reduce((total, moduleId) => {
            const moduleDoc = state.modules[moduleId];
            if (!moduleDoc || !appliesToShuffle(moduleDoc.shuffles, name)) {
                return total;
            }
            return (
                total +
                calculateSumValueForModuleByField(
                    moduleDoc,
                    fieldName,
                    state,
                    name,
                    occurrenceCtx,
                )
            );
        }, 0);
    }
    return totals;
}
