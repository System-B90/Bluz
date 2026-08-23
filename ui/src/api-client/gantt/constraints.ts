import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { baseDocumentFixup, RawBaseDocument } from "@/api-client/gantt/base";
import { ClientApiError } from "@/api-shared/errors";
import { CreateConstraintPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
    RelationalConstraint,
    TemporalConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { GanttEventId } from "@/api-shared/types/gantt/models/event";

export type { CreateConstraintPayload };

/**
 * Constraint document as it arrives from the server before client-side
 * normalization -- a loose superset of both union members (plus whatever
 * base-document fields `baseDocumentFixup` has already fixed up), since the
 * server doesn't discriminate the JSON shape by `type` the way the client
 * model does.
 */
type RawServerConstraint = RawBaseDocument & {
    id: string;
    type: ConstraintType;
    ownerEventId?: GanttEventId;
    ownerModuleId?: GanttModuleId;
    targetEventId?: GanttEventId;
    targetModuleId?: GanttModuleId;
    relation?: RelationalConstraint["relation"];
    minDelayDays?: number;
    maxDelayDays?: number;
    allowedDays?: Array<GanttDayIndex>;
    forbiddenDays?: Array<GanttDayIndex>;
};

/**
 * Narrows a raw server constraint into the discriminated `GanttConstraint`
 * union. Builds the return value by naming exactly the fields each union
 * member declares -- rather than spreading the leftover raw fields -- so
 * server-only bookkeeping (e.g. `createdAt`/`updatedAt`, which
 * `baseDocumentFixup` sets before this runs but which `GanttConstraint`
 * doesn't declare) can't silently ride along on an object typed as the
 * narrow union.
 */
function normalizeConstraintObject(
    serverConstraint: RawServerConstraint,
): GanttConstraint {
    const { id, type, ownerEventId, ownerModuleId } = serverConstraint;
    const ownerType = ownerModuleId ? "module" : "event";
    if (ownerType === "event" && !ownerEventId) {
        throw new ClientApiError(
            `Malformed constraint! Owner type is "event" but no ownerEventId was provided.`,
        );
    }

    if (type === ConstraintType.Relational) {
        const { targetEventId, targetModuleId, relation, minDelayDays, maxDelayDays } =
            serverConstraint;
        const targetType = targetModuleId ? "module" : "event";
        if (targetType === "event" && !targetEventId) {
            throw new ClientApiError(
                `Malformed constraint! Target type is "event" but no targetEventId was provided.`,
            );
        }
        return {
            id,
            type,
            ownerEventId,
            ownerModuleId,
            ownerType,
            targetId: (targetEventId ?? targetModuleId)!,
            targetType,
            relation,
            minDelayDays,
            maxDelayDays,
        } as RelationalConstraint;
    } else if (type === ConstraintType.Temporal) {
        const { allowedDays, forbiddenDays } = serverConstraint;
        return {
            id,
            type,
            ownerEventId,
            ownerModuleId,
            ownerType,
            allowedDays,
            forbiddenDays,
        } as TemporalConstraint;
    } else {
        throw new ClientApiError(
            `Malformed constraint! Unknown constraint type "${type}"`,
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
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/constraints`,
        window.location.origin,
    );

    if (syllabusId) url.searchParams.append("syllabusId", syllabusId);
    if (moduleId) url.searchParams.append("moduleId", moduleId);

    const rawData = await safeApiFetcher<Array<RawServerConstraint>>(
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
    const rawData = await safeApiFetcher<RawServerConstraint>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/constraints`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(payload),
        },
    );
    return normalizeConstraintObject(
        baseDocumentFixup(rawData as RawServerConstraint),
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
    const rawData = await safeApiFetcher<RawServerConstraint>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/constraints`,
        {
            ...options,
            method: "PATCH",
            body: JSON.stringify({ id, ...payload }),
        },
    );
    return normalizeConstraintObject(
        baseDocumentFixup(rawData as RawServerConstraint),
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
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/constraints`,
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
