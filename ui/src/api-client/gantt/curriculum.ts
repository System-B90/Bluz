import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import {
    BaseDocument,
    baseDocumentFixup,
    clientGantApiBuilder,
    DateFixup,
    RawBaseDocument,
} from "@/api-client/gantt/base";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttConstraint,
    GanttCurriculum,
    GanttCurriculumModuleDayMapping,
} from "@/api-shared/types/gantt/models";

export type GanttCurriculumDocument = GanttCurriculum & BaseDocument;

/**
 * Shape returned by `GET /api/gantt/curriculums/[id]/export` — the full
 * curriculum tree plus its day mappings and constraints, versioned so a
 * future export format change can be detected on import.
 */
export type GanttCurriculumExport = {
    version: string;
    curriculum: RawBaseDocument;
    mappings: Array<GanttCurriculumModuleDayMapping>;
    constraints: Array<GanttConstraint>;
};

const baseCurriculumApi = clientGantApiBuilder<
    GanttCurriculum,
    CreateGanttCurriculumPayload
>({
    apiBaseUrl: "/api/gantt/curriculums",
    dateFixup: baseDocumentFixup as DateFixup<
        GanttCurriculum & RawBaseDocument
    >,
});

async function apiExport(
    id: string,
    options?: ClientApiProps,
): Promise<GanttCurriculumExport> {
    return await safeApiFetcher<GanttCurriculumExport>(
        `/api/gantt/curriculums/${encodeURIComponent(id)}/export`,
        options,
    );
}

async function apiImport(
    payload: unknown,
    options?: ClientApiProps,
): Promise<GanttCurriculumDocument> {
    const rawData = await safeApiFetcher<any>(`/api/gantt/curriculums/import`, {
        ...options,
        method: "POST",
        body: JSON.stringify(payload),
    });
    return baseDocumentFixup(rawData) as GanttCurriculumDocument;
}

export type DuplicateCurriculumOverrides = {
    title?: string;
    isDraft?: boolean;
    isArchived?: boolean;
};

/**
 * Server-side deep clone of a curriculum into a fully independent copy (#319,
 * #322). Returns the freshly created curriculum.
 */
async function apiDuplicate(
    id: string,
    overrides: DuplicateCurriculumOverrides = {},
    options?: ClientApiProps,
): Promise<GanttCurriculumDocument> {
    const rawData = await safeApiFetcher<any>(
        `/api/gantt/curriculums/${encodeURIComponent(id)}/duplicate`,
        {
            ...options,
            method: "POST",
            body: JSON.stringify(overrides),
        },
    );
    return baseDocumentFixup(rawData) as GanttCurriculumDocument;
}

const curriculumApi = {
    ...baseCurriculumApi,
    apiExport,
    apiImport,
    apiDuplicate,
} as const;

const { apiList, apiGet, apiCreate, apiUpdate, apiDelete, apiGetMany } =
    curriculumApi;

export {
    apiCreate as apiCreateCurriculum,
    apiDelete as apiDeleteCurriculum,
    apiGet as apiGetCurriculum,
    apiGetMany as apiGetManyCurriculums,
    apiList as apiListCurriculums,
    apiUpdate as apiUpdateCurriculum,
    apiExport as apiExportCurriculum,
    apiImport as apiImportCurriculum,
    curriculumApi,
};
