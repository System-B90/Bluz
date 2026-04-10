export interface NormalizedStore
{
    curriculums: Record<CurriculumId, Curriculum>;
    syllabuses: Record<SyllabusId, Syllabus>;
    modules: Record<ModuleId, Module>;
    events: Record<ModuleEventId, ModuleEvent>;
}

export function normalizeCurriculumData(apiData: ApiCurriculum): NormalizedStore
{
    const store: NormalizedStore = {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: {}
    };

    const curriculumSyllabusIds: SyllabusId[] = [];

    // Traverse the nested structure
    for (const apiSyllabus of apiData.syllabuses)
    {
        curriculumSyllabusIds.push(apiSyllabus.id);
        const syllabusModuleIds: ModuleId[] = [];

        for (const apiModule of apiSyllabus.modules)
        {
            syllabusModuleIds.push(apiModule.id);
            const moduleEventIds: ModuleEventId[] = [];

            for (const apiEvent of apiModule.events)
            {
                moduleEventIds.push(apiEvent.id);

                // 1. Store the flat Event
                store.events[ apiEvent.id ] = { ...apiEvent };
            }

            // 2. Store the flat Module, swapping the nested events for IDs
            store.modules[ apiModule.id ] = {
                id: apiModule.id,
                title: apiModule.title,
                description: apiModule.description,
                hiveIds: [ ...apiModule.hiveIds ],
                events: moduleEventIds, // Now an Array<ModuleEventId>
            };
        }

        // 3. Store the flat Syllabus, swapping nested modules for IDs
        store.syllabuses[ apiSyllabus.id ] = {
            id: apiSyllabus.id,
            title: apiSyllabus.title,
            hiveIds: [ ...apiSyllabus.hiveIds ],
            modules: syllabusModuleIds, // Now an Array<ModuleId>
        };
    }

    // 4. Store the root Curriculum, swapping nested syllabuses for IDs
    store.curriculums[ apiData.id ] = {
        id: apiData.id,
        title: apiData.title,
        description: apiData.description,
        draft: apiData.draft,
        weeks: [ ...apiData.weeks ], // Weeks/Days are kept embedded per your types
        syllabuses: curriculumSyllabusIds, // Now an Array<SyllabusId>
    };

    return store;
}

