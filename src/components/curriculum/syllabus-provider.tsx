'use client';
import { apiCreateSyllabus, apiDeleteSyllabus, apiGetSyllabus, apiListSyllabuses, apiUpdateSyllabus } from "@/api-client/curriculum/syllabus";
import { buildItemProvider } from "@/components/curriculum/base-provider";
import { CurriculumId, Syllabus } from "@/api-shared/types/curriculum";

const { provider, use } = buildItemProvider<Syllabus, CurriculumId>({
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
