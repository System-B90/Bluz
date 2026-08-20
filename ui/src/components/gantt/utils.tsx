import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    EventRecurrence,
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
    GanttEvent,
    GanttEventRecurrenceException,
    GanttModule,
    GanttSyllabus,
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
};

/**
 * Number of times an event occurs on the timeline: 1 for a non-recurring or
 * unplaced event, otherwise 1 (its mapped start day) plus every surviving
 * echoed occurrence — skipping days recorded as recurrence exceptions (#111).
 */
function countEventOccurrences(
    event: GanttEvent,
    eventId: string,
    state: NormalizedStore,
    ctx?: RecurrenceOccurrenceContext,
): number {
    if (event.recurrence === EventRecurrence.None || !ctx) return 1;

    let startDayId: string | undefined;
    for (const mapping of Object.values(ctx.mappings)) {
        if (mapping.eventId === eventId) {
            startDayId = mapping.dayId;
            break;
        }
    }
    if (!startDayId) return 1;

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
    });

    return (excludedDayIds.has(startDayId) ? 0 : 1) + echoDayIds.size;
}

function calculateSumValueForModuleByField(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    shuffle?: string,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return (module.events ?? []).reduce((evtTotal, eventId) => {
        const event = state.events[eventId];
        if (!event) return evtTotal;
        if (shuffle !== undefined && !appliesToShuffle(event.shuffles, shuffle)) {
            return evtTotal;
        }

        const occurrences = countEventOccurrences(
            event,
            eventId,
            state,
            occurrenceCtx,
        );
        return evtTotal + (event[fieldName] ?? 0) * occurrences;
    }, 0);
}

/**
 * Per-shuffle sums of an event field for a module, or null when none of the
 * module's events are shuffle-tagged (⇒ all shuffles are identical).
 */
export function getModuleShuffleTotals(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): null | Record<string, number> {
    const names = new Set<string>();
    for (const eventId of module.events ?? []) {
        for (const s of state.events[eventId]?.shuffles ?? []) names.add(s);
    }
    if (names.size === 0) return null;

    const totals: Record<string, number> = {};
    for (const name of names) {
        totals[name] = calculateSumValueForModuleByField(
            module,
            fieldName,
            state,
            name,
            occurrenceCtx,
        );
    }
    return totals;
}

/** True when per-shuffle totals are unequal (⇒ shuffles get different time). */
export function doShuffleTotalsDiffer(
    totals: null | Record<string, number>,
): boolean {
    if (!totals) return false;
    return new Set(Object.values(totals)).size > 1;
}

// When events are shuffle-tagged, the representative module total is the
// shuffle with the maximum sum (untagged events count for every shuffle).
function calculateRepresentativeValueForModule(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    const totals = getModuleShuffleTotals(module, fieldName, state, occurrenceCtx);
    if (!totals) {
        return calculateSumValueForModuleByField(
            module,
            fieldName,
            state,
            undefined,
            occurrenceCtx,
        );
    }
    return Math.max(...Object.values(totals));
}

export function calculateMinimumRequiredTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateRepresentativeValueForModule(
        module,
        "minimumDuration",
        state,
        occurrenceCtx,
    );
}

export function calculateAllocatedTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateRepresentativeValueForModule(
        module,
        "allocatedDuration",
        state,
        occurrenceCtx,
    );
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

type CallbackFunc<T> = (
    item: T,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
) => number;

function calculateSumForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
    moduleCallbackFunc: CallbackFunc<GanttModule>,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return (syllabus.modules ?? []).reduce((modTotal, moduleId) => {
        const moduleDoc = state.modules[moduleId];
        if (!moduleDoc) return modTotal;

        return modTotal + moduleCallbackFunc(moduleDoc, state, occurrenceCtx);
    }, 0);
}

// The representative syllabus total is the shuffle with the maximum sum
// across its applicable modules/events (issue #107); without shuffles it is
// the plain sum.
function calculateRepresentativeValueForSyllabus(
    syllabus: GanttSyllabus,
    fieldName: "allocatedDuration" | "minimumDuration",
    state: NormalizedStore,
    moduleCallbackFunc: CallbackFunc<GanttModule>,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    const totals = getSyllabusShuffleTotals(syllabus, fieldName, state, occurrenceCtx);
    if (totals) {
        return Math.max(...Object.values(totals));
    }
    return calculateSumForSyllabus(syllabus, state, moduleCallbackFunc, occurrenceCtx);
}

export function calculateMinimumRequiredTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateRepresentativeValueForSyllabus(
        syllabus,
        "minimumDuration",
        state,
        calculateMinimumRequiredTimeForModule,
        occurrenceCtx,
    );
}

export function calculateAllocatedTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateRepresentativeValueForSyllabus(
        syllabus,
        "allocatedDuration",
        state,
        calculateAllocatedTimeForModule,
        occurrenceCtx,
    );
}

function calculateSumForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
    syllabusCallbackFunc: CallbackFunc<GanttSyllabus>,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return curriculum.syllabuses.reduce((sylTotal, syllabusId) => {
        const syllabus = state.syllabuses[syllabusId];
        if (!syllabus) return sylTotal;

        return sylTotal + syllabusCallbackFunc(syllabus, state, occurrenceCtx);
    }, 0);
}
export function calculateMinimumRequiredTimeForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateSumForCurriculum(
        curriculum,
        state,
        calculateMinimumRequiredTimeForSyllabus,
        occurrenceCtx,
    );
}

export function calculateAllocatedTimeForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
    occurrenceCtx?: RecurrenceOccurrenceContext,
): number {
    return calculateSumForCurriculum(
        curriculum,
        state,
        calculateAllocatedTimeForSyllabus,
        occurrenceCtx,
    );
}
