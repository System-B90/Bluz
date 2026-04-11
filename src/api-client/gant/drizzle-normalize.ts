import { ApiCurriculum } from "@/api-shared/types/gant/api-layer";
import { CurriculumId, Curriculum, SyllabusId, Syllabus, ModuleId, ModuleEventId, ModuleEvent, Module } from "@/api-shared/types/gant/curriculum";

export interface NormalizedStore
{
    curriculums: Record<CurriculumId, Curriculum>;
    syllabuses: Record<SyllabusId, Syllabus>;
    modules: Record<ModuleId, Module>;
    events: Record<ModuleEventId, ModuleEvent>;
}

export function normalizeCurriculumData(apiData: any): NormalizedStore
{
    const store: NormalizedStore = {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: {}
    };

    const curriculumSyllabusIds: SyllabusId[] = [];

    // Traverse Curriculums -> cS (Junction) -> Syllabus
    for (const link of (apiData.cS ?? []))
    {
        const apiSyllabus = link.syllabus;
        curriculumSyllabusIds.push(apiSyllabus.id);
        const syllabusModuleIds: ModuleId[] = [];

        // Traverse Syllabus -> sM (Junction) -> Module
        for (const sMLink of (apiSyllabus.sM ?? []))
        {
            const apiModule = sMLink.module;
            syllabusModuleIds.push(apiModule.id);
            const moduleEventIds: ModuleEventId[] = [];

            // Traverse Module -> mE (Junction) -> Event
            for (const mELink of (apiModule.mE ?? []))
            {
                const apiEvent = mELink.event;
                moduleEventIds.push(apiEvent.id);

                store.events[ apiEvent.id ] = { ...apiEvent };
            }

            store.modules[ apiModule.id ] = {
                id: apiModule.id,
                title: apiModule.title,
                description: apiModule.description,
                hiveIds: [ ...(apiModule.hiveIds ?? []) ],
                events: moduleEventIds,
            };
        }

        store.syllabuses[ apiSyllabus.id ] = {
            id: apiSyllabus.id,
            title: apiSyllabus.title,
            hiveIds: [ ...(apiSyllabus.hiveIds ?? []) ],
            modules: syllabusModuleIds,
        };
    }

    store.curriculums[ apiData.id ] = {
        id: apiData.id,
        title: apiData.title,
        description: apiData.description,
        draft: apiData.draft,
        weeks: [ ...(apiData.weeks ?? []) ],
        syllabuses: curriculumSyllabusIds,
    };

    return store;
}
