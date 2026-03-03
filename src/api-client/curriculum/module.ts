import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { BaseDocument } from "@/api-client/curriculum/curriculum";
import { CurriculumId, Module, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";

export async function apiListModules({ curriculumId, syllabusId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; }, options?: ClientApiProps): Promise<Array<ModuleId>>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module`, options);
}

export async function apiGetModule({ curriculumId, syllabusId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; }, moduleId: ModuleId, options?: ClientApiProps): Promise<Module & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}`, options);
}

export async function apiCreateModule({ curriculumId, syllabusId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; }, newModule: Omit<Module, 'id'>, options?: ClientApiProps): Promise<Module & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(newModule),
    });
}

export async function apiUpdateModule({ curriculumId, syllabusId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; }, updates: Partial<Syllabus> & { id: SyllabusId; }, options?: ClientApiProps): Promise<Module & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${updates.id}`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

export async function apiDeleteModule({ curriculumId, syllabusId }: { curriculumId: CurriculumId; syllabusId: SyllabusId; }, moduleId: ModuleId, options?: ClientApiProps): Promise<void>
{
    await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}/module/${moduleId}`, {
        ...options,
        method: 'DELETE',
    });
}
