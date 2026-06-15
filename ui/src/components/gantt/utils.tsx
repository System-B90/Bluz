import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculum,
    GanttEvent,
    GanttModule,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";

type NumberFieldKeys<T> = {
    [K in keyof T]: T[K] extends null | number | undefined ? K : never;
}[keyof T];

function calculateSumValueForModuleByField(
    module: GanttModule,
    fieldName: NumberFieldKeys<GanttEvent>,
    state: NormalizedStore,
): number {
    return (module.events ?? []).reduce((evtTotal, eventId) => {
        const event = state.events[eventId];
        if (!event) return evtTotal;

        return evtTotal + (event[fieldName] ?? 0);
    }, 0);
}

export function calculateMinimumRequiredTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
): number {
    return calculateSumValueForModuleByField(module, "minimumDuration", state);
}

export function calculateAllocatedTimeForModule(
    module: GanttModule,
    state: NormalizedStore,
): number {
    return calculateSumValueForModuleByField(
        module,
        "allocatedDuration",
        state,
    );
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

export function calculateMinimumRequiredTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
): number {
    return calculateSumForSyllabus(
        syllabus,
        state,
        calculateMinimumRequiredTimeForModule,
    );
}

export function calculateAllocatedTimeForSyllabus(
    syllabus: GanttSyllabus,
    state: NormalizedStore,
): number {
    return calculateSumForSyllabus(
        syllabus,
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
