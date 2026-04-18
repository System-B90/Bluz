import {
  BaseDocument,
  baseDocumentFixup,
  clientGantApiBuilder,
} from "@/api-client/gantt/base";
import { CreateGanttDayPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttDay } from "@/api-shared/types/gantt/models/curriculum";

export type GanttDayDocument = GanttDay & BaseDocument;

const dayApi = clientGantApiBuilder<GanttDay, CreateGanttDayPayload>({
  apiBaseUrl: "/api/gantt/days",
  dateFixup: baseDocumentFixup as any,
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
