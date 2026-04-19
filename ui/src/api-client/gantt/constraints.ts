/**
 * Name: constraints.ts
 * Purpose: Client-side API wrappers for Gantt relational and temporal constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";

// Matches the Omit type used in the Provider context
export type CreateConstraintPayload = Omit<GanttConstraint, "id" | "createdAt" | "updatedAt">;

/**
 * GET: Retrieves all constraints for a curriculum's modules and events.
 */
async function apiGetConstraints(
    curriculumId: GanttCurriculumId,
    options?: ClientApiProps,
): Promise<Array<GanttConstraint>> {
    const url = new URL(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        window.location.origin,
    );

    const rawData: Array<RawBaseDocument> = await safeApiFetcher(url.toString(), {
        ...options,
    });
    
    return rawData.map(
        baseDocumentFixup,
    ) as unknown as Array<GanttConstraint>;
}

/**
 * POST: Creates a new relational or temporal constraint.
 * Note: Assumes the endpoint is nested under the curriculum for uniform routing.
 */
async function apiCreateConstraint(
    curriculumId: GanttCurriculumId,
    payload: CreateConstraintPayload,
    options?: ClientApiProps,
): Promise<GanttConstraint> {
    const rawData = await safeApiFetcher(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
    return baseDocumentFixup(
        rawData as RawBaseDocument,
    ) as unknown as GanttConstraint;
}

/**
 * PATCH: Updates an existing constraint.
 */
async function apiUpdateConstraint(
    curriculumId: GanttCurriculumId,
    id: string,
    payload: Partial<CreateConstraintPayload>,
    options?: ClientApiProps,
): Promise<GanttConstraint> {
    const rawData = await safeApiFetcher(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        {
            ...options,
            method: "PATCH",
            body: JSON.stringify({ id, ...payload }),
        },
    );
    return baseDocumentFixup(
        rawData as RawBaseDocument,
    ) as unknown as GanttConstraint;
}

/**
 * DELETE: Removes a constraint.
 */
async function apiDeleteConstraint(
    curriculumId: GanttCurriculumId,
    id: string,
    options?: ClientApiProps,
): Promise<void> {
    await safeApiFetcher(`/api/gantt/curriculums/${curriculumId}/constraints`, {
        ...options,
        method: "DELETE",
        body: JSON.stringify({ id }),
    });
}

export const ganttConstraintsApi = {
    apiGet: apiGetConstraints,
    apiCreate: apiCreateConstraint,
    apiUpdate: apiUpdateConstraint,
    apiDelete: apiDeleteConstraint,
} as const;