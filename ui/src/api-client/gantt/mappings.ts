/**
 * Name: mappings.ts
 * Purpose: Client-side API wrappers for curriculum-module-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { GanttCurriculumId, GanttModuleId } from "@/api-shared/types/gantt/curriculum";
import { GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/mapping";

/**
 * GET: Retrieves all module mappings for a curriculum.
 */
async function apiGetModuleDayMapping(
    curriculumId: GanttCurriculumId,
    weekIndex?: number,
    options?: ClientApiProps
): Promise<Array<GanttCurriculumModuleDayMapping>>
{
    const url = new URL(`/api/gantt/curriculums/${curriculumId}/mappings`, window.location.origin);
    if (weekIndex !== undefined) url.searchParams.append('weekIndex', weekIndex.toString());

    const rawData: Array<RawBaseDocument> = await safeApiFetcher(url.toString(), {
        ...options,
    });
    return rawData.map(baseDocumentFixup) as unknown as Array<GanttCurriculumModuleDayMapping>;
}

/**
 * POST: Creates a new module-to-day mapping.
 */
async function apiCreateModuleDayMapping(
    curriculumId: GanttCurriculumId,
    payload: { moduleId: GanttModuleId; weekIndex: number; dayIndex: number; sortOrder?: number; },
    options?: ClientApiProps
): Promise<GanttCurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return baseDocumentFixup(rawData as RawBaseDocument) as unknown as GanttCurriculumModuleDayMapping;
}

/**
 * PATCH: Updates an existing mapping or reorders it.
 */
async function apiUpdateModuleDayMapping(
    curriculumId: GanttCurriculumId,
    oldMapping: { moduleId: GanttModuleId; weekIndex: number; dayIndex: number; },
    newValues: { weekIndex?: number; dayIndex?: number; sortOrder?: number; },
    options?: ClientApiProps
): Promise<GanttCurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify({ oldMapping, newValues }),
    });
    return baseDocumentFixup(rawData as RawBaseDocument) as unknown as GanttCurriculumModuleDayMapping;
}

/**
 * DELETE: Removes a module-to-day mapping.
 */
async function apiDeleteModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    weekIndex: number,
    dayIndex: number,
    options?: ClientApiProps
): Promise<void>
{
    await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/mappings`, {
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
