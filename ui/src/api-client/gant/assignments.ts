import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup } from "@/api-client/gant/base";
import { CurriculumId, ModuleId } from "@/api-shared/types/gant/curriculum";
import { CurriculumModuleDayMapping } from "@/api-shared/types/gant/mapping";

async function apiGetModuleDayMapping(curriculumId: CurriculumId, options?: ClientApiProps): Promise<Array<CurriculumModuleDayMapping>>
{
    const rawData = await safeApiFetcher(`/api/gant/curriculums/${curriculumId}/mappings/`, {
        ...options,
    });
    return rawData.map(baseDocumentFixup);
}

async function apiCreateModuleDayMapping(curriculumId: CurriculumId, moduleId: ModuleId, options?: ClientApiProps): Promise<CurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gant/curriculums/${curriculumId}/mappings/`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return baseDocumentFixup(rawData);
}
