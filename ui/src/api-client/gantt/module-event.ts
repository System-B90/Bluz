import { safeApiFetcher } from "@/api-client/common";
import {
    asDateFixup,
    BaseDocument,
    baseDocumentFixup,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttEvent, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";

export type ModuleEventDocument = GanttEvent & BaseDocument;

const moduleEventApi = clientGantApiBuilder<
    GanttEvent,
    CreateGanttEventPayload
>({ apiBaseUrl: "/api/gantt/events", dateFixup: asDateFixup<GanttEvent & RawBaseDocument>() });
const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    moduleEventApi;

async function apiDuplicate(
    eventId: GanttEventId,
    moduleId: GanttModuleId,
): Promise<ModuleEventDocument> {
    const rawData = await safeApiFetcher<GanttEvent & RawBaseDocument>(
        `/api/gantt/events/${encodeURIComponent(eventId)}/duplicate`,
        {
            method: "POST",
            body: JSON.stringify({ moduleId }),
        },
    );
    return baseDocumentFixup(rawData);
}

/**
 * Reconciles the event's shuffle group so it covers exactly `shuffles`, one
 * sibling event per name (#699). Returns the surviving members and the ids of
 * members dropped because their shuffle is no longer part of the group.
 */
async function apiApplyShuffleGroup(
    eventId: GanttEventId,
    moduleId: GanttModuleId,
    shuffles: Array<string>,
): Promise<{
    members: Array<ModuleEventDocument>;
    removedIds: Array<GanttEventId>;
}> {
    const raw = await safeApiFetcher<{
        members: Array<GanttEvent & RawBaseDocument>;
        removedIds: Array<GanttEventId>;
    }>(`/api/gantt/events/${encodeURIComponent(eventId)}/shuffle-group`, {
        method: "POST",
        body: JSON.stringify({ moduleId, shuffles }),
    });

    return {
        members: raw.members.map(baseDocumentFixup),
        removedIds: raw.removedIds,
    };
}

const extendedModuleEventApi = {
    ...moduleEventApi,
    apiDuplicate,
    apiApplyShuffleGroup,
} as const;

export {
    apiCreate as apiCreateModuleEvent,
    apiDelete as apiDeleteModuleEvent,
    apiGetMany as apiGetManyModuleEvents,
    apiGet as apiGetModuleEvent,
    apiList as apiListModuleEvents,
    apiUpdate as apiUpdateModuleEvent,
    apiDuplicate as apiDuplicateModuleEvent,
    apiApplyShuffleGroup as apiApplyModuleEventShuffleGroup,
    extendedModuleEventApi as moduleEventApi,
};
