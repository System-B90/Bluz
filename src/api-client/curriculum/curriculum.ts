import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { CurriculumId, Curriculum } from "@/api-shared/types/curriculum";
import { Dayjs } from "dayjs";

export type BaseDocument = {
    createdAt: Dayjs;
    updatedAt: Dayjs;
};
export type CurriculumDocument = Curriculum & BaseDocument;

function curriculumDateFixup<T extends Partial<CurriculumDocument> | null>(curriculum: T): T | null
{
    if (!curriculum) { return null; }
    inplaceDateFixup(curriculum, [ 'updatedAt', 'createdAt' ]);
    return curriculum;
}

export async function apiListCurriculums(options?: ClientApiProps): Promise<Array<CurriculumId>>
{
    return await safeApiFetcher(`/api/curriculum`, options);
}

export async function apiGetCurriculum(curriculumId: CurriculumId, options?: ClientApiProps): Promise<CurriculumDocument>
{
    return curriculumDateFixup(await safeApiFetcher(`/api/curriculum/${curriculumId}`, options));
}

export async function apiCreateCurriculum(newCurriculum: Omit<Curriculum, 'id'>, options?: ClientApiProps): Promise<CurriculumDocument>
{
    return curriculumDateFixup(await safeApiFetcher(`/api/curriculum`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(newCurriculum),
    }));
}

export async function apiUpdateCurriculum(updates: Partial<Curriculum> & { id: CurriculumId; }, options?: ClientApiProps): Promise<CurriculumDocument>
{
    return curriculumDateFixup(await safeApiFetcher(`/api/curriculum/${updates.id}`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(updates),
    }));
}

export async function apiDeleteCurriculum(curriculumId: CurriculumId, options?: ClientApiProps): Promise<void>
{
    await safeApiFetcher(`/api/curriculum/${curriculumId}`, {
        ...options,
        method: 'DELETE',
    });
}
