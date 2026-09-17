import { baseDocumentFixup } from "@/api-client/gantt/base";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttDayDocument } from "@/api-client/gantt/day";
import { ModuleDocument } from "@/api-client/gantt/module";
import { ModuleEventDocument } from "@/api-client/gantt/module-event";
import { SyllabusDocument } from "@/api-client/gantt/syllabus";
import { CurriculumWeekDocument } from "@/api-client/gantt/week";
import { ApiCurriculum, ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import {
    DAY_NAME_DISPLAY,
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

export type NormalizedStore = {
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>;
    syllabuses: Record<
        GanttSyllabusId,
        SyllabusDocument & { curriculumId: GanttCurriculumId }
    >;
    modules: Record<
        GanttModuleId,
        ModuleDocument & { syllabusId: GanttSyllabusId }
    >;
    events: Record<
        GanttEventId,
        ModuleEventDocument & { moduleId: GanttModuleId }
    >;
    weeks: Record<
        GanttWeekId,
        CurriculumWeekDocument & {
            id: GanttWeekId;
            curriculumId: GanttCurriculumId;
        }
    >;
    days: Record<
        GanttDayId,
        GanttDayDocument & { id: GanttDayId; weekId: GanttWeekId }
    >;
};

/**
 * Normalized store slices for a single syllabus and its module/event subtree.
 * Reused both by full-curriculum normalization and by the link flow (#320),
 * which receives one fully-populated `ApiSyllabus` and must fold its modules +
 * events into the store — not just the bare syllabus record.
 */
export type NormalizedSyllabusSubtree = {
    syllabus: SyllabusDocument & { curriculumId: GanttCurriculumId };
    modules: Array<ModuleDocument & { syllabusId: GanttSyllabusId }>;
    events: Array<ModuleEventDocument & { moduleId: GanttModuleId }>;
};

/**
 * Flattens one `ApiSyllabus` (with nested `s2m → module → m2e → event`) into
 * normalized store slices, resolving the reverse child-id arrays.
 */
export function normalizeApiSyllabus(
    rawSyllabus: ApiSyllabus,
    curriculumId: GanttCurriculumId,
): NormalizedSyllabusSubtree {
    const apiSyllabus = baseDocumentFixup(rawSyllabus);
    const syllabusModuleIds: Array<GanttModuleId> = [];
    const modules: NormalizedSyllabusSubtree["modules"] = [];
    const events: NormalizedSyllabusSubtree["events"] = [];

    for (const sMLink of apiSyllabus.s2m ?? []) {
        const apiModule = baseDocumentFixup(sMLink.module);
        syllabusModuleIds.push(apiModule.id);
        const moduleEventIds: Array<GanttEventId> = [];

        for (const mELink of apiModule.m2e ?? []) {
            const apiEvent = baseDocumentFixup(mELink.event);
            moduleEventIds.push(apiEvent.id);
            events.push({
                ...apiEvent,
                moduleId: apiModule.id,
                allocatedDuration:
                    apiEvent.cEC?.find(
                        (c) => c.curriculumId === curriculumId,
                    )?.allocatedDuration ?? 0,
                constraints: [],
            });
        }

        modules.push({
            id: apiModule.id,
            title: apiModule.title,
            description: apiModule.description,
            updatedAt: apiModule.updatedAt,
            createdAt: apiModule.createdAt,
            hiveIds: [...(apiModule.hiveIds ?? [])],
            shuffles: [...(apiModule.shuffles ?? [])],
            events: moduleEventIds,
            syllabusId: apiSyllabus.id,
            constraints: [],
        });
    }

    return {
        syllabus: {
            id: apiSyllabus.id,
            title: apiSyllabus.title,
            updatedAt: apiSyllabus.updatedAt,
            createdAt: apiSyllabus.createdAt,
            hiveIds: [...(apiSyllabus.hiveIds ?? [])],
            shuffles: [...(apiSyllabus.shuffles ?? [])],
            modules: syllabusModuleIds,
            curriculumId,
        },
        modules,
        events,
    };
}

export function normalizeCurriculumData(
    apiData: ApiCurriculum,
): NormalizedStore {
    const store: NormalizedStore = {
        curriculums: {},
        syllabuses: {},
        modules: {},
        events: {},
        weeks: {},
        days: {},
    };

    const curriculumSyllabusIds: Array<GanttSyllabusId> = [];
    const curriculumWeekIds: Array<GanttWeekId> = [];

    const apiCurriculum = baseDocumentFixup(apiData);
    for (const link of apiData.c2s ?? []) {
        const { syllabus, modules, events } = normalizeApiSyllabus(
            link.syllabus,
            apiCurriculum.id,
        );
        curriculumSyllabusIds.push(syllabus.id);

        for (const eventDoc of events) {
            store.events[eventDoc.id] = eventDoc;
        }
        for (const moduleDoc of modules) {
            store.modules[moduleDoc.id] = moduleDoc;
        }
        store.syllabuses[syllabus.id] = syllabus;
    }

    // Normalize weeks
    for (const wLink of apiData.c2w ?? []) {
        const apiWeek = baseDocumentFixup(wLink.week);
        curriculumWeekIds.push(apiWeek.id);
        const weekDayIds: Array<GanttDayId> = [];

        // Normalize days within week
        for (const dLink of apiWeek.w2d ?? []) {
            const apiDay = baseDocumentFixup(dLink.day);
            weekDayIds.push(apiDay.id);

            store.days[apiDay.id] = {
                id: apiDay.id,
                title:
                    DAY_NAME_DISPLAY[apiDay.dayIndex] ??
                    `יום ${apiDay.dayIndex + 1}`,
                weekId: dLink.weekId,
                dayIndex: apiDay.dayIndex,
                totalWorkingMinutes: apiDay.totalWorkingMinutes,
                dayEndTime: apiDay.dayEndTime ?? null,
                comment: apiDay.comment,
                createdAt: apiDay.createdAt,
                updatedAt: apiDay.updatedAt,
            };
        }

        store.weeks[apiWeek.id] = {
            id: apiWeek.id,
            title: `שבוע ${apiWeek.number}`,
            curriculumId: apiCurriculum.id,
            number: apiWeek.number,
            days: weekDayIds.sort(
                (a, b) => store.days[a].dayIndex - store.days[b].dayIndex,
            ), // The days should intuitively be sorted by their chronological time in the week
            comment: apiWeek.comment,
            weekendDuty: apiWeek.weekendDuty,
            createdAt: apiWeek.createdAt,
            updatedAt: apiWeek.updatedAt,
        };
    }

    store.curriculums[apiCurriculum.id] = {
        id: apiCurriculum.id,
        title: apiCurriculum.title,
        description: apiCurriculum.description,
        startDate: apiCurriculum.startDate,
        isDraft: apiCurriculum.isDraft,
        isArchived: apiCurriculum.isArchived ?? false,
        updatedAt: apiCurriculum.updatedAt,
        createdAt: apiCurriculum.createdAt,
        weeks: curriculumWeekIds.sort(
            (a, b) => store.weeks[a].number - store.weeks[b].number,
        ),
        syllabuses: curriculumSyllabusIds,
    };

    return store;
}
