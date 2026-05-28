/**
 * Name: mappings.ts
 * Purpose: Client-side API wrappers for curriculum-module-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { CreateGanttCurriculumEventDayMapping } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

/**
 * GET: Retrieves all module mappings for a curriculum.
 */
async function apiGetModuleDayMapping(
    curriculumId: GanttCurriculumId,
    dayId?: Array<GanttDayId> | GanttDayId,
    options?: ClientApiProps,
): Promise<Array<GanttCurriculumModuleDayMapping>> {
    const url = new URL(
        `/api/gantt/curriculums/${curriculumId}/mappings`,
        window.location.origin,
    );
    if (dayId !== undefined) {
        Array.isArray(dayId)
            ? dayId.forEach((dayId) =>
                url.searchParams.append("dayId", dayId.toString()),
            )
            : url.searchParams.append("dayId", dayId.toString());
    }

    const rawData = await safeApiFetcher<Array<RawBaseDocument>>(url.toString(), {
        ...options,
    });
    return rawData.map(
        baseDocumentFixup,
    ) as unknown as Array<GanttCurriculumModuleDayMapping>;
}

/**
 * POST: Creates a new module-to-day mapping.
 */
async function apiCreateModuleDayMapping(
    curriculumId: GanttCurriculumId,
    payload: CreateGanttCurriculumEventDayMapping,
    options?: ClientApiProps,
): Promise<GanttCurriculumModuleDayMapping> {
    const rawData = await safeApiFetcher<RawBaseDocument>(
        `/api/gantt/curriculums/${curriculumId}/mappings`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
    return baseDocumentFixup(
    rawData as RawBaseDocument,
    ) as unknown as GanttCurriculumModuleDayMapping;
}

/**
 * PATCH: Updates an existing mapping or reorders it.
 */
async function apiUpdateModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    oldMapping: { dayId: GanttDayId },
    newValues: { dayId?: GanttDayId; sortOrder?: number },
    options?: ClientApiProps,
): Promise<GanttCurriculumModuleDayMapping> {
    const rawData = await safeApiFetcher<RawBaseDocument>(
        `/api/gantt/curriculums/${curriculumId}/mappings`,
        {
            ...options,
            method: "PATCH",
            body: JSON.stringify({ moduleId, eventId, oldMapping, newValues }),
        },
    );
    return baseDocumentFixup(
    rawData as RawBaseDocument,
    ) as unknown as GanttCurriculumModuleDayMapping;
}

/**
 * DELETE: Removes a module-to-day mapping.
 */
async function apiDeleteModuleDayMapping(
    curriculumId: GanttCurriculumId,
    moduleId: GanttModuleId,
    eventId: GanttEventId | null,
    dayId: GanttDayId,
    options?: ClientApiProps,
): Promise<void> {
    await safeApiFetcher<void>(`/api/gantt/curriculums/${curriculumId}/mappings`, {
        ...options,
        method: "DELETE",
        body: JSON.stringify({ moduleId, eventId, dayId }),
    });
}

export const curriculumModuleDayMappingApi = {
    apiGet: apiGetModuleDayMapping,
    apiCreate: apiCreateModuleDayMapping,
    apiUpdate: apiUpdateModuleDayMapping,
    apiDelete: apiDeleteModuleDayMapping,
} as const;
