import { baseDocumentFixup } from "@/api-client/gantt/base";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttDayDocument } from "@/api-client/gantt/day";
import { ModuleDocument } from "@/api-client/gantt/module";
import { ModuleEventDocument } from "@/api-client/gantt/module-event";
import { SyllabusDocument } from "@/api-client/gantt/syllabus";
import { CurriculumWeekDocument } from "@/api-client/gantt/week";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { DAY_NAME_DISPLAY, GanttCurriculumId, GanttDayId, GanttEventId, GanttModuleId, GanttSyllabusId, GanttWeekId } from "@/api-shared/types/gantt/curriculum";

export interface NormalizedStore
{
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>;
    syllabuses: Record<GanttSyllabusId, SyllabusDocument & { curriculumId: GanttCurriculumId; }>;
    modules: Record<GanttModuleId, ModuleDocument & { syllabusId: GanttSyllabusId; }>;
    events: Record<GanttEventId, ModuleEventDocument & { moduleId: GanttModuleId; }>;
    weeks: Record<GanttWeekId, CurriculumWeekDocument & { id: GanttWeekId; curriculumId: GanttCurriculumId; }>;
    days: Record<GanttDayId, GanttDayDocument & { id: GanttDayId; weekId: GanttWeekId; }>;
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

    const curriculumSyllabusIds: GanttSyllabusId[] = [];
    const curriculumWeekIds: GanttWeekId[] = [];

    const apiCurriculum = baseDocumentFixup(apiData);
    for (const link of (apiData.c2s ?? []))
    {
        const apiSyllabus = baseDocumentFixup(link.syllabus);
        curriculumSyllabusIds.push(apiSyllabus.id);
        const syllabusModuleIds: GanttModuleId[] = [];

        for (const sMLink of (apiSyllabus.s2m ?? []))
        {
            const apiModule = baseDocumentFixup(sMLink.module);
            syllabusModuleIds.push(apiModule.id);
            const moduleEventIds: GanttEventId[] = [];

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
        const weekDayIds: Array<GanttDayId> = [];

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
