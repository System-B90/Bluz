import {
    asDateFixup,
    BaseDocument,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttModule } from "@/api-shared/types/gantt/models";

export type ModuleDocument = GanttModule & BaseDocument;

const moduleApi = clientGantApiBuilder<GanttModule, CreateGanttModulePayload>({
    apiBaseUrl: "/api/gantt/modules",
    dateFixup: asDateFixup<GanttModule & RawBaseDocument>(),
});
const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    moduleApi;
export {
    apiCreate as apiCreateModule,
    apiDelete as apiDeleteModule,
    apiGetMany as apiGetManyModules,
    apiGet as apiGetModule,
    apiList as apiListModules,
    apiUpdate as apiUpdateModule,
};

export { moduleApi };
