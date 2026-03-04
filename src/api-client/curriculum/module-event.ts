import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { BaseDocument } from "@/api-client/curriculum/curriculum";
import { CurriculumId, ModuleEvent, ModuleEventId, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";

export async function apiListModuleEvents({ curriculumId, syllabusId, moduleId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; moduleId: ModuleId; }, options?: ClientApiProps): Promise<Array<ModuleEventId>>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}/events`, options);
}

export async function apiGetModuleEvent({ curriculumId, syllabusId, moduleId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; moduleId: ModuleId; }, eventId: ModuleEventId, options?: ClientApiProps): Promise<ModuleEvent & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}/events/${eventId}`, options);
}

export async function apiCreateModuleEvent({ curriculumId, syllabusId, moduleId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; moduleId: ModuleId; }, newModuleEvent: Omit<ModuleEvent, 'id'>, options?: ClientApiProps): Promise<ModuleEvent & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}/events`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(newModuleEvent),
    });
}

export async function apiUpdateModuleEvent({ curriculumId, syllabusId, moduleId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; moduleId: ModuleId; }, updates: Partial<Syllabus> & { id: SyllabusId; }, options?: ClientApiProps): Promise<ModuleEvent & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}/events/${updates.id}`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

export async function apiDeleteModuleEvent({ curriculumId, syllabusId, moduleId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; moduleId: ModuleId; }, eventId: ModuleEventId, options?: ClientApiProps): Promise<void>
{
    await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}/events/${eventId}`, {
        ...options,
        method: 'DELETE',
    });
}
