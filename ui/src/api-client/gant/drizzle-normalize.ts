import { baseDocumentFixup } from "@/api-client/gant/base";
import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { ModuleDocument } from "@/api-client/gant/module";
import { ModuleEventDocument } from "@/api-client/gant/module-event";
import { SyllabusDocument } from "@/api-client/gant/syllabus";
import { CurriculumDay, CurriculumDayId, CurriculumId, CurriculumWeek, CurriculumWeekId, DAY_NAME_DISPLAY, DayName, ModuleEventId, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";

export interface NormalizedStore
{
    curriculums: Record<CurriculumId, CurriculumDocument>;
    syllabuses: Record<SyllabusId, SyllabusDocument>;
    modules: Record<ModuleId, ModuleDocument>;
    events: Record<ModuleEventId, ModuleEventDocument>;
    weeks: Record<CurriculumWeekId, CurriculumWeek & { id: CurriculumWeekId; curriculumId: CurriculumId; }>;
    days: Record<CurriculumDayId, CurriculumDay & { id: CurriculumDayId; curriculumWeekId: CurriculumWeekId; }>;
    moduleToSyllabusLookup: Record<ModuleId, SyllabusId>;
}

export function normalizeCurriculumData(apiData: any): NormalizedStore
{
    const store: NormalizedStore = {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: {},
        weeks: {},
        days: {},
        moduleToSyllabusLookup: {},
    };

    const curriculumSyllabusIds: SyllabusId[] = [];
    const curriculumWeekIds: CurriculumWeekId[] = [];

    // Traverse Curriculums -> cS (Junction) -> Syllabus
    for (const link of (apiData.cS ?? []))
    {
        const apiSyllabus = baseDocumentFixup(link.syllabus);
        curriculumSyllabusIds.push(apiSyllabus.id);
        const syllabusModuleIds: ModuleId[] = [];

        // Traverse Syllabus -> sM (Junction) -> Module
        for (const sMLink of (apiSyllabus.sM ?? []))
        {
            const apiModule = baseDocumentFixup(sMLink.module);
            syllabusModuleIds.push(apiModule.id);
            const moduleEventIds: ModuleEventId[] = [];

            // Traverse Module -> mE (Junction) -> Event
            for (const mELink of (apiModule.mE ?? []))
            {
                const apiEvent = baseDocumentFixup(mELink.event);
                moduleEventIds.push(apiEvent.id);
                store.events[ apiEvent.id ] = { ...apiEvent, allocatedDuration: apiEvent.cEC[ 0 ]?.allocatedDuration ?? 0 };
            }

            store.moduleToSyllabusLookup[ apiModule.id ] = apiSyllabus.id;
            store.modules[ apiModule.id ] = {
                id: apiModule.id,
                title: apiModule.title,
                description: apiModule.description,
                updatedAt: apiModule.updatedAt,
                createdAt: apiModule.createdAt,
                hiveIds: [ ...(apiModule.hiveIds ?? []) ],
                events: moduleEventIds,
            };
        }

        store.syllabuses[ apiSyllabus.id ] = {
            id: apiSyllabus.id,
            title: apiSyllabus.title,
            updatedAt: apiSyllabus.updatedAt,
            createdAt: apiSyllabus.createdAt,
            hiveIds: [ ...(apiSyllabus.hiveIds ?? []) ],
            modules: syllabusModuleIds,
        };
    }

    // Normalize weeks
    for (const apiWeek of (apiData.weeks ?? []))
    {
        const weekId = apiWeek.id as CurriculumWeekId;
        curriculumWeekIds.push(weekId);
        const dayIds: CurriculumDayId[] = [];

        // Normalize days within week
        for (const apiDay of (apiWeek.days ?? []))
        {
            const dayId = apiDay.id as CurriculumDayId;
            dayIds.push(dayId);
            store.days[ dayId ] = {
                id: dayId,
                title: DAY_NAME_DISPLAY[apiDay.day as DayName] ?? `יום ${apiDay.day}`,
                curriculumWeekId: weekId,
                day: apiDay.day,
                totalWorkingHours: apiDay.totalWorkingHours,
                comment: apiDay.comment,
            };
        }

        store.weeks[ weekId ] = {
            id: weekId,
            title: `שבוע ${apiWeek.number}`,
            curriculumId: apiData.id,
            number: apiWeek.number,
            days: dayIds,
            comment: apiWeek.comment,
            closingSaturday: apiWeek.closingSaturday,
        };
    }

    store.curriculums[ apiData.id ] = {
        id: apiData.id,
        title: apiData.title,
        description: apiData.description,
        draft: apiData.draft,
        updatedAt: apiData.updatedAt,
        createdAt: apiData.createdAt,
        weeks: curriculumWeekIds,
        syllabuses: curriculumSyllabusIds,
    };

    return store;
}
