import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { BaseDocument } from "@/api-client/curriculum/curriculum";
import { CurriculumId, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";

export async function apiListSyllabuses(curriculumId: CurriculumId, options?: ClientApiProps): Promise<Array<SyllabusId>>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus`, options);
}

export async function apiGetSyllabus(curriculumId: CurriculumId, syllabusId: SyllabusId, options?: ClientApiProps): Promise<Syllabus & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}`, options);
}

export async function apiCreateSyllabus(curriculumId: CurriculumId, newSyllabus: Omit<Syllabus, 'id'>, options?: ClientApiProps): Promise<Syllabus & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(newSyllabus),
    });
}

export async function apiUpdateSyllabus(curriculumId: CurriculumId, updates: Partial<Syllabus> & { id: SyllabusId; }, options?: ClientApiProps): Promise<Syllabus & BaseDocument>
{
    return await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${updates.id}`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

export async function apiDeleteSyllabus(curriculumId: CurriculumId, syllabusId: SyllabusId, options?: ClientApiProps): Promise<void>
{
    await safeApiFetcher(`/api/curriculum/${curriculumId}/syllabus/${syllabusId}`, {
        ...options,
        method: 'DELETE',
    });
}