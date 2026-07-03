import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculum,
    GanttEvent,
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

function calculateSumValueForModuleByField(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
    shuffle?: string,
): number {
    return (module.events ?? []).reduce((evtTotal, eventId) => {
        const event = state.events[eventId];
        if (!event) return evtTotal;
        if (shuffle !== undefined && !appliesToShuffle(event.shuffles, shuffle)) {
            return evtTotal;
        }

        return evtTotal + (event[fieldName] ?? 0);
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
): number {
    const totals = getModuleShuffleTotals(module, fieldName, state);
    if (!totals) {
        return calculateSumValueForModuleByField(module, fieldName, state);
    }
    return Math.max(...Object.values(totals));
}

export function calculateMinimumRequiredTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
): number {
    return calculateRepresentativeValueForModule(
        module,
        "minimumDuration",
        state,
    );
}

export function calculateAllocatedTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
): number {
    return calculateRepresentativeValueForModule(
        module,
        "allocatedDuration",
        state,
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
                )
            );
        }, 0);
    }
    return totals;
}

type CallbackFunc<T> = (item: T, state: NormalizedStore) => number;

function calculateSumForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
    moduleCallbackFunc: CallbackFunc<GanttModule>,
): number {
    return (syllabus.modules ?? []).reduce((modTotal, moduleId) => {
        const moduleDoc = state.modules[moduleId];
        if (!moduleDoc) return modTotal;

        return modTotal + moduleCallbackFunc(moduleDoc, state);
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
): number {
    const totals = getSyllabusShuffleTotals(syllabus, fieldName, state);
    if (totals) {
        return Math.max(...Object.values(totals));
    }
    return calculateSumForSyllabus(syllabus, state, moduleCallbackFunc);
}

export function calculateMinimumRequiredTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
): number {
    return calculateRepresentativeValueForSyllabus(
        syllabus,
        "minimumDuration",
        state,
        calculateMinimumRequiredTimeForModule,
    );
}

export function calculateAllocatedTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
): number {
    return calculateRepresentativeValueForSyllabus(
        syllabus,
        "allocatedDuration",
        state,
        calculateAllocatedTimeForModule,
    );
}

function calculateSumForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
    syllabusCallbackFunc: CallbackFunc<GanttSyllabus>,
): number {
    return curriculum.syllabuses.reduce((sylTotal, syllabusId) => {
        const syllabus = state.syllabuses[syllabusId];
        if (!syllabus) return sylTotal;

        return sylTotal + syllabusCallbackFunc(syllabus, state);
    }, 0);
}
export function calculateMinimumRequiredTimeForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
): number {
    return calculateSumForCurriculum(
        curriculum,
        state,
        calculateMinimumRequiredTimeForSyllabus,
    );
}

export function calculateAllocatedTimeForCurriculum(
    curriculum: GanttCurriculum,
    state: NormalizedStore,
): number {
    return calculateSumForCurriculum(
        curriculum,
        state,
        calculateAllocatedTimeForSyllabus,
    );
}
