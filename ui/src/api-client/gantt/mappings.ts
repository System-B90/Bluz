/**
 * Name: mappings.ts
 * Purpose: Client-side API wrappers for curriculum-module-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { CreateGanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/create-payloads";
import { GanttCurriculumId, GanttDayId, GanttModuleId } from "@/api-shared/types/gantt/models/curriculum";
import { GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models/curriculum-day-module-mapping";

/**
 * GET: Retrieves all module mappings for a curriculum.
 */
async function apiGetModuleDayMapping(
    curriculumId: GanttCurriculumId,
    dayId?: Array<GanttDayId> | GanttDayId,
    options?: ClientApiProps
): Promise<Array<GanttCurriculumModuleDayMapping>>
{
    const url = new URL(`/api/gantt/curriculums/${curriculumId}/mappings`, window.location.origin);
    if (dayId !== undefined)
    {
        Array.isArray(dayId)
            ? dayId.forEach((dayId) => url.searchParams.append('dayId', dayId.toString()))
            : url.searchParams.append('dayId', dayId.toString());
    }

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
    payload: CreateGanttCurriculumModuleDayMapping,
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
    moduleId: GanttModuleId,
    oldMapping: { dayId: GanttDayId; },
    newValues: { dayId?: GanttDayId; sortOrder?: number; },
    options?: ClientApiProps
): Promise<GanttCurriculumModuleDayMapping>
{
    const rawData = await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify({ moduleId, oldMapping, newValues }),
    });
    return baseDocumentFixup(rawData as RawBaseDocument) as unknown as GanttCurriculumModuleDayMapping;
}

/**
 * DELETE: Removes a module-to-day mapping.
 */
async function apiDeleteModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    dayId: GanttDayId,
    options?: ClientApiProps
): Promise<void>
{
    await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: 'DELETE',
        body: JSON.stringify({ moduleId, dayId }),
    });
}

export const curriculumModuleDayMappingApi = {
    apiGet: apiGetModuleDayMapping,
    apiCreate: apiCreateModuleDayMapping,
    apiUpdate: apiUpdateModuleDayMapping,
    apiDelete: apiDeleteModuleDayMapping,
} as const;
