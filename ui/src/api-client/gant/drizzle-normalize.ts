import { baseDocumentFixup } from "@/api-client/gant/base";
import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumDayDocument } from "@/api-client/gant/day";
import { ModuleDocument } from "@/api-client/gant/module";
import { ModuleEventDocument } from "@/api-client/gant/module-event";
import { SyllabusDocument } from "@/api-client/gant/syllabus";
import { CurriculumWeekDocument } from "@/api-client/gant/week";
import { ApiCurriculum } from "@/api-shared/types/gant/api-layer";
import { CurriculumDayId, CurriculumId, CurriculumWeekId, DAY_NAME_DISPLAY, ModuleEventId, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";

export interface NormalizedStore
{
    curriculums: Record<CurriculumId, CurriculumDocument>;
    syllabuses: Record<SyllabusId, SyllabusDocument & { curriculumId: CurriculumId; }>;
    modules: Record<ModuleId, ModuleDocument & { syllabusId: SyllabusId; }>;
    events: Record<ModuleEventId, ModuleEventDocument & { moduleId: ModuleId; }>;
    weeks: Record<CurriculumWeekId, CurriculumWeekDocument & { id: CurriculumWeekId; curriculumId: CurriculumId; }>;
    days: Record<CurriculumDayId, CurriculumDayDocument & { id: CurriculumDayId; weekId: CurriculumWeekId; }>;
}

export function normalizeCurriculumData(apiData: ApiCurriculum): NormalizedStore
{
    const store: NormalizedStore = {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: {},
        weeks: {},
        days: {},
    };

    const curriculumSyllabusIds: SyllabusId[] = [];
    const curriculumWeekIds: CurriculumWeekId[] = [];

    const apiCurriculum = baseDocumentFixup(apiData);
    for (const link of (apiData.c2s ?? []))
    {
        const apiSyllabus = baseDocumentFixup(link.syllabus);
        curriculumSyllabusIds.push(apiSyllabus.id);
        const syllabusModuleIds: ModuleId[] = [];

        for (const sMLink of (apiSyllabus.s2m ?? []))
        {
            const apiModule = baseDocumentFixup(sMLink.module);
            syllabusModuleIds.push(apiModule.id);
            const moduleEventIds: ModuleEventId[] = [];

            for (const mELink of (apiModule.m2e ?? []))
            {
                const apiEvent = baseDocumentFixup(mELink.event);
                moduleEventIds.push(apiEvent.id);
                store.events[ apiEvent.id ] = { ...apiEvent, moduleId: apiModule.id, allocatedDuration: apiEvent.cEC[ 0 ]?.allocatedDuration ?? 0 };
            }

            store.modules[ apiModule.id ] = {
                id: apiModule.id,
                title: apiModule.title,
                description: apiModule.description,
                updatedAt: apiModule.updatedAt,
                createdAt: apiModule.createdAt,
                hiveIds: [ ...(apiModule.hiveIds ?? []) ],
                events: moduleEventIds,
                syllabusId: apiSyllabus.id,
            };
        }

        store.syllabuses[ apiSyllabus.id ] = {
            id: apiSyllabus.id,
            title: apiSyllabus.title,
            updatedAt: apiSyllabus.updatedAt,
            createdAt: apiSyllabus.createdAt,
            hiveIds: [ ...(apiSyllabus.hiveIds ?? []) ],
            modules: syllabusModuleIds,
            curriculumId: apiCurriculum.id,
        };
    }

    // Normalize weeks
    for (const wLink of (apiData.c2w ?? []))
    {
        const apiWeek = baseDocumentFixup(wLink.week);
        curriculumWeekIds.push(apiWeek.id);
        const weekDayIds: Array<CurriculumDayId> = [];

        // Normalize days within week
        for (const dLink of (apiWeek.w2d ?? []))
        {
            const apiDay = baseDocumentFixup(dLink.day);
            weekDayIds.push(apiDay.id);

            store.days[ apiDay.id ] = {
                id: apiDay.id,
                title: DAY_NAME_DISPLAY[ apiDay.dayIndex ] ?? `יום ${apiDay.dayIndex + 1}`,
                weekId: apiDay.weekId,
                dayIndex: apiDay.dayIndex,
                totalWorkingMinutes: apiDay.totalWorkingMinutes,
                comment: apiDay.comment,
                createdAt: apiDay.createdAt,
                updatedAt: apiDay.updatedAt,
            };
        }

        store.weeks[ apiWeek.id ] = {
            id: apiWeek.id,
            title: `שבוע ${apiWeek.number}`,
            curriculumId: apiCurriculum.id,
            number: apiWeek.number,
            days: weekDayIds,
            comment: apiWeek.comment,
            weekendDuty: apiWeek.weekendDuty,
            createdAt: apiWeek.createdAt,
            updatedAt: apiWeek.updatedAt,
        };
    }

    store.curriculums[ apiCurriculum.id ] = {
        id: apiCurriculum.id,
        title: apiCurriculum.title,
        description: apiCurriculum.description,
        isDraft: apiCurriculum.isDraft,
        updatedAt: apiCurriculum.updatedAt,
        createdAt: apiCurriculum.createdAt,
        weeks: curriculumWeekIds,
        syllabuses: curriculumSyllabusIds,
    };

    console.log(store);
    return store;
}
