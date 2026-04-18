import {
  BaseDocument,
  baseDocumentFixup,
  clientGantApiBuilder,
} from "@/api-client/gantt/base";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttCurriculum } from "@/api-shared/types/gantt/models/curriculum";

export type GanttCurriculumDocument = GanttCurriculum & BaseDocument;

const curriculumApi = clientGantApiBuilder<
  GanttCurriculum,
  CreateGanttCurriculumPayload
>({
  apiBaseUrl: "/api/gantt/curriculums",
  dateFixup: baseDocumentFixup as any,
});
const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
  curriculumApi;
export {
  apiCreate as apiCreateCurriculum,
  apiDelete as apiDeleteCurriculum,
  apiGet as apiGetCurriculum,
  apiGetMany as apiGetManyCurriculums,
  apiList as apiListCurriculums,
  apiUpdate as apiUpdateCurriculum,
  curriculumApi,
};
