'use client';
import { apiCreateSyllabus, apiDeleteSyllabus, apiGetSyllabus, apiListSyllabuses, apiUpdateSyllabus } from "@/api-client/curriculum/syllabus";
import { buildItemsProvider } from "@/components/curriculum/base-items-provider";
import { CurriculumId, Syllabus } from "@/api-shared/types/curriculum";

const { provider, use } = buildItemsProvider<Syllabus, CurriculumId>({
    apiList: apiListSyllabuses,
    apiGet: apiGetSyllabus,
    apiCreate: apiCreateSyllabus,
    apiDelete: apiDeleteSyllabus,
    apiUpdate: apiUpdateSyllabus,
    itemName: 'סילבוס',
    providerName: 'SyllabusProvider',
    useName: 'useSyllabus',
});

export { provider as SyllabusProvider };
export { use as useSyllabus };
