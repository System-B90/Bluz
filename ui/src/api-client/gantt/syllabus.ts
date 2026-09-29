import { safeApiFetcher } from "@/api-client/common";
import {
    asDateFixup,
    BaseDocument,
    clientGantApiBuilder,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import { SyllabusExportDocument } from "@/api-shared/types/gantt/syllabus-export";

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

/** One syllabus as an importable file (#757). */
export async function apiExportSyllabus(
    id: string,
    curriculumId: string,
): Promise<SyllabusExportDocument> {
    const query = new URLSearchParams({ curriculumId });
    return await safeApiFetcher<SyllabusExportDocument>(
        `/api/gantt/syllabuses/${encodeURIComponent(id)}/export?${query.toString()}`,
    );
}

/** Adds an exported syllabus to `curriculumId` as a new copy (#757). */
export async function apiImportSyllabus(
    curriculumId: string,
    document: unknown,
): Promise<ApiSyllabus> {
    return await safeApiFetcher<ApiSyllabus>(
        `/api/gantt/curriculums/${encodeURIComponent(curriculumId)}/import-syllabus`,
        { method: "POST", body: JSON.stringify(document) },
    );
}
