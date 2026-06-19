import {
    BaseDocument,
    baseDocumentFixup,
    clientGantApiBuilder,
} from "@/api-client/gantt/base";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttModule } from "@/api-shared/types/gantt/models";

export type ModuleDocument = GanttModule & BaseDocument;

const moduleApi = clientGantApiBuilder<GanttModule, CreateGanttModulePayload>({
    apiBaseUrl: "/api/gantt/modules",
    dateFixup: baseDocumentFixup as any,
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
