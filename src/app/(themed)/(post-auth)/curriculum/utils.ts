import { apiGetModule } from "@/api-client/curriculum/module";
import { apiGetModuleEvent } from "@/api-client/curriculum/module-event";
import { apiGetSyllabus } from "@/api-client/curriculum/syllabus";
import { Curriculum, Module, ModuleEvent, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";

type NumberFieldKeys<T> = {
    [ K in keyof T ]: T[ K ] extends number | undefined | null ? K : never;
}[ keyof T ];

async function calculateSumValueForModuleByField(module: Module, fieldName: NumberFieldKeys<ModuleEvent>): Promise<number>
{
    return await module.events.reduce(async (prev, moduleEventId) =>
    {
        const moduleEvent = await apiGetModuleEvent({ curriculumId: '_', syllabusId: '_', moduleId: module.id }, moduleEventId);
        return await prev + (moduleEvent[ fieldName ] ?? 0);
    }, Promise.resolve(0));
}

export async function calculateMinimumRequiredTimeForModule(module: Module): Promise<number>
{
    return await calculateSumValueForModuleByField(module, 'minimumDuration');
}

export async function calculateAllocatedTimeForModule(module: Module): Promise<number>
{
    return await calculateSumValueForModuleByField(module, 'allocatedDuration');
}

export async function calculateMinimumRequiredTimeForSyllabus(syllabus: Syllabus): Promise<number>
{
    return await syllabus.modules.reduce(async (prev, moduleId) =>
    {
        const module = await apiGetModule({ curriculumId: '_', syllabusId: syllabus.id }, moduleId);
        return await prev + await calculateMinimumRequiredTimeForModule(module);
    }, Promise.resolve(0));
}
export async function calculateMinimumRequiredTimeForCurriculum(curriculum: Curriculum, syllabuses: Array<SyllabusId>): Promise<number>
{
    return await syllabuses.reduce(async (prev, syllabusId) =>
    {
        const syllabus = await apiGetSyllabus(curriculum.id, syllabusId);
        return await prev + await calculateMinimumRequiredTimeForSyllabus(syllabus);
    }, Promise.resolve(0));
}
