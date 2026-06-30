import { safeApiFetcher } from "@/api-client/common";
import {
    BaseDocument,
    baseDocumentFixup,
    clientGantApiBuilder,
} from "@/api-client/gantt/base";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttEvent, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";

export type ModuleEventDocument = GanttEvent & BaseDocument;

const moduleEventApi = clientGantApiBuilder<
    GanttEvent,
    CreateGanttEventPayload
>({ apiBaseUrl: "/api/gantt/events", dateFixup: baseDocumentFixup as any });
const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    moduleEventApi;

async function apiDuplicate(
    eventId: GanttEventId,
    moduleId: GanttModuleId,
): Promise<ModuleEventDocument> {
    const rawData = await safeApiFetcher<GanttEvent>(
        `/api/gantt/events/${eventId}/duplicate`,
        {
            method: "POST",
            body: JSON.stringify({ moduleId }),
        },
    );
    return baseDocumentFixup(rawData);
}

const extendedModuleEventApi = {
    ...moduleEventApi,
    apiDuplicate,
} as const;

export {
    apiCreate as apiCreateModuleEvent,
    apiDelete as apiDeleteModuleEvent,
    apiGetMany as apiGetManyModuleEvents,
    apiGet as apiGetModuleEvent,
    apiList as apiListModuleEvents,
    apiUpdate as apiUpdateModuleEvent,
    apiDuplicate as apiDuplicateModuleEvent,
    extendedModuleEventApi as moduleEventApi,
};
