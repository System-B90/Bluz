import {
    asDateFixup,
    BaseDocument,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttSyllabus } from "@/api-shared/types/gantt/models";

export type SyllabusDocument = GanttSyllabus & BaseDocument;

const syllabusApi = clientGantApiBuilder<
    GanttSyllabus,
    CreateGanttSyllabusPayload
>({ apiBaseUrl: "/api/gantt/syllabuses", dateFixup: asDateFixup<GanttSyllabus & RawBaseDocument>() });

const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    syllabusApi;
export {
    apiCreate as apiCreateSyllabus,
    apiDelete as apiDeleteSyllabus,
    apiGetMany as apiGetManySyllabuses,
    apiGet as apiGetSyllabus,
    apiList as apiListSyllabuses,
    apiUpdate as apiUpdateSyllabus,
    syllabusApi,
};
