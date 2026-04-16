import { NormalizedStore } from "@/api-client/gant/drizzle-normalize";
import { Curriculum, Module, ModuleEvent, Syllabus } from "@/api-shared/types/gant/curriculum";

type NumberFieldKeys<T> = {
    [ K in keyof T ]: T[ K ] extends number | undefined | null ? K : never;
}[ keyof T ];

function calculateSumValueForModuleByField(module: Module, fieldName: NumberFieldKeys<ModuleEvent>, state: NormalizedStore): number
{
    return (module.events ?? []).reduce((evtTotal, eventId) =>
    {
        const event = state.events[ eventId ];
        if (!event) return evtTotal;

        return evtTotal + (event[ fieldName ] ?? 0);
    }, 0);
}

export function calculateMinimumRequiredTimeForModule(module: Module, state: NormalizedStore): number
{
    return calculateSumValueForModuleByField(module, 'minimumDuration', state);
}

export function calculateAllocatedTimeForModule(module: Module, state: NormalizedStore): number
{
    return calculateSumValueForModuleByField(module, 'allocatedDuration', state);
}

type CallbackFunc<T> = (item: T, state: NormalizedStore) => number;

function calculateSumForSyllabus(syllabus: Syllabus, state: NormalizedStore, moduleCallbackFunc: CallbackFunc<Module>): number
{
    return (syllabus.modules ?? []).reduce((modTotal, moduleId) =>
    {
        const moduleDoc = state.modules[ moduleId ];
        if (!moduleDoc) return modTotal;

        return modTotal + moduleCallbackFunc(moduleDoc, state);
    }, 0);
}

export function calculateMinimumRequiredTimeForSyllabus(syllabus: Syllabus, state: NormalizedStore): number
{
    return calculateSumForSyllabus(syllabus, state, calculateMinimumRequiredTimeForModule);
}

export function calculateAllocatedTimeForSyllabus(syllabus: Syllabus, state: NormalizedStore): number
{
    return calculateSumForSyllabus(syllabus, state, calculateAllocatedTimeForModule);
}

function calculateSumForCurriculum(curriculum: Curriculum, state: NormalizedStore, syllabusCallbackFunc: CallbackFunc<Syllabus>): number
{
    return curriculum.syllabuses.reduce((sylTotal, syllabusId) =>
    {
        const syllabus = state.syllabuses[ syllabusId ];
        if (!syllabus) return sylTotal;

        return sylTotal + syllabusCallbackFunc(syllabus, state);
    }, 0);
}
export function calculateMinimumRequiredTimeForCurriculum(curriculum: Curriculum, state: NormalizedStore): number
{
    return calculateSumForCurriculum(curriculum, state, calculateMinimumRequiredTimeForSyllabus);
}

export function calculateAllocatedTimeForCurriculum(curriculum: Curriculum, state: NormalizedStore): number
{
    return calculateSumForCurriculum(curriculum, state, calculateAllocatedTimeForSyllabus);
}
