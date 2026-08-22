import {
    asDateFixup,
    BaseDocument,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttDayPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttDay } from "@/api-shared/types/gantt/models";

export type GanttDayDocument = GanttDay & BaseDocument;

const dayApi = clientGantApiBuilder<GanttDay, CreateGanttDayPayload>({
    apiBaseUrl: "/api/gantt/days",
    dateFixup: asDateFixup<GanttDay & RawBaseDocument>(),
});

const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } = dayApi;

export {
    apiCreate as apiCreateDay,
    apiDelete as apiDeleteDay,
    apiGet as apiGetDay,
    apiGetMany as apiGetManyDays,
    apiList as apiListDays,
    apiUpdate as apiUpdateDay,
    dayApi,
};
