import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { CreateConstraintPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";

export type { CreateConstraintPayload };

function normalizeConstraintObject(serverConstraint: any): GanttConstraint {
    if (serverConstraint.type === ConstraintType.Relational) {
        const {
            ownerEventId,
            ownerModuleId,
            targetEventId,
            targetModuleId,
            ...otherParams
        } = serverConstraint;
        const targetType = targetModuleId ? "module" : "event";
        if (targetType === "event" && !targetEventId) {
            throw Error(
                `Malformed constraint! Target type is "event" but no targetEventId was provided.`,
            );
        }
        const ownerType = ownerModuleId ? "module" : "event";
        if (ownerType === "event" && !ownerEventId) {
            throw Error(
                `Malformed constraint! Owner type is "event" but no ownerEventId was provided.`,
            );
        }

        return {
            ...otherParams,
            ownerEventId,
            ownerModuleId,
            ownerType,
            targetId: targetEventId ?? targetModuleId,
            targetType,
        };
    } else if (serverConstraint.type === ConstraintType.Temporal) {
        const { ownerEventId, ownerModuleId, ...otherParams } =
            serverConstraint;
        const ownerType = ownerModuleId ? "module" : "event";
        if (ownerType === "event" && !ownerEventId) {
            throw Error(
                `Malformed constraint! Owner type is "event" but no ownerEventId was provided.`,
            );
        }
        return {
            ...otherParams,
            ownerEventId,
            ownerModuleId,
            ownerType,
        };
    } else {
        throw Error(
            `Malformed constraint! Unknown constraint type "${serverConstraint.type}"`,
        );
    }
}

/**
 * GET: Retrieves all constraints for a curriculum's modules and events.
 */
async function apiGetConstraints(
    curriculumId: GanttCurriculumId,
    {
        syllabusId,
        moduleId,
    }: { syllabusId?: GanttSyllabusId; moduleId?: GanttModuleId },
    options?: ClientApiProps,
): Promise<Array<GanttConstraint>> {
    const url = new URL(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        window.location.origin,
    );

    if (syllabusId) url.searchParams.append("syllabusId", syllabusId);
    if (moduleId) url.searchParams.append("moduleId", moduleId);

    const rawData = await safeApiFetcher<Array<RawBaseDocument>>(
        url.toString(),
        {
            ...options,
        },
    );

    return rawData
        .map(baseDocumentFixup)
        .map(normalizeConstraintObject) as Array<GanttConstraint>;
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
    const rawData = await safeApiFetcher<RawBaseDocument>(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
    return normalizeConstraintObject(
        baseDocumentFixup(rawData as RawBaseDocument),
    );
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
    const rawData = await safeApiFetcher<RawBaseDocument>(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        {
            ...options,
            method: "PATCH",
            body: JSON.stringify({ id, ...payload }),
        },
    );
    return normalizeConstraintObject(
        baseDocumentFixup(rawData as RawBaseDocument),
    );
}

/**
 * DELETE: Removes a constraint.
 */
async function apiDeleteConstraint(
    curriculumId: GanttCurriculumId,
    id: string,
    options?: ClientApiProps,
): Promise<void> {
    await safeApiFetcher<void>(
        `/api/gantt/curriculums/${curriculumId}/constraints`,
        {
            ...options,
            method: "DELETE",
            body: JSON.stringify({ id }),
        },
    );
}

/**
 * Client-side API client wrapper for managing Gantt constraints.
 * Provides endpoints for retrieving, creating, updating, and deleting constraints.
 */
export const ganttConstraintsApi = {
    apiGet: apiGetConstraints,
    apiCreate: apiCreateConstraint,
    apiUpdate: apiUpdateConstraint,
    apiDelete: apiDeleteConstraint,
} as const;
