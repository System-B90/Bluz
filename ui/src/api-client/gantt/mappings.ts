/**
 * Name: mappings.ts
 * Purpose: Client-side API wrappers for curriculum-module-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { CurriculumId, ModuleId } from "@/api-shared/types/gantt/curriculum";
import { CurriculumModuleDayMapping } from "@/api-shared/types/gantt/mapping";

/**
 * GET: Retrieves all module mappings for a curriculum.
 */
async function apiGetModuleDayMapping(
    curriculumId: CurriculumId,
    weekIndex?: number,
    options?: ClientApiProps
): Promise<Array<CurriculumModuleDayMapping>>
{
    const url = new URL(`/api/gant/curriculums/${curriculumId}/mappings`, window.location.origin);
    if (weekIndex !== undefined) url.searchParams.append('weekIndex', weekIndex.toString());

    const rawData: Array<RawBaseDocument> = await safeApiFetcher(url.toString(), {
        ...options,
    });
    return rawData.map(baseDocumentFixup) as unknown as Array<CurriculumModuleDayMapping>;
}

/**
 * POST: Creates a new module-to-day mapping.
 */
async function apiCreateModuleDayMapping(
    curriculumId: CurriculumId,
    payload: { moduleId: ModuleId; weekIndex: number; dayIndex: number; sortOrder?: number; },
    options?: ClientApiProps
): Promise<CurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gant/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return baseDocumentFixup(rawData as RawBaseDocument) as unknown as CurriculumModuleDayMapping;
}

/**
 * PATCH: Updates an existing mapping or reorders it.
 */
async function apiUpdateModuleDayMapping(
    curriculumId: CurriculumId,
    oldMapping: { moduleId: ModuleId; weekIndex: number; dayIndex: number; },
    newValues: { weekIndex?: number; dayIndex?: number; sortOrder?: number; },
    options?: ClientApiProps
): Promise<CurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gant/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify({ oldMapping, newValues }),
    });
    return baseDocumentFixup(rawData as RawBaseDocument) as unknown as CurriculumModuleDayMapping;
}

/**
 * DELETE: Removes a module-to-day mapping.
 */
async function apiDeleteModuleDayMapping(
    curriculumId: CurriculumId,
    moduleId: ModuleId,
    weekIndex: number,
    dayIndex: number,
    options?: ClientApiProps
): Promise<void>
{
    await safeApiFetcher(`/api/gant/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'DELETE',
        body: JSON.stringify({ moduleId, weekIndex, dayIndex }),
    });
}

export const curriculumModuleDayMappingApi = {
    apiGet: apiGetModuleDayMapping,
    apiCreate: apiCreateModuleDayMapping,
    apiUpdate: apiUpdateModuleDayMapping,
    apiDelete: apiDeleteModuleDayMapping,
} as const;
