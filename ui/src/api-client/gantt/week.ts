import {
    asDateFixup,
    BaseDocument,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttWeekPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttWeek } from "@/api-shared/types/gantt/models";

export type CurriculumWeekDocument = GanttWeek & BaseDocument;

const weekApi = clientGantApiBuilder<GanttWeek, CreateGanttWeekPayload>({
    apiBaseUrl: "/api/gantt/weeks",
    dateFixup: asDateFixup<GanttWeek & RawBaseDocument>(),
});

const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    weekApi;

export {
    apiCreate as apiCreateWeek,
    apiDelete as apiDeleteWeek,
    apiGetMany as apiGetManyWeeks,
    apiGet as apiGetWeek,
    apiList as apiListWeeks,
    apiUpdate as apiUpdateWeek,
    weekApi,
};
