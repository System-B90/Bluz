import { Dayjs } from "dayjs";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import {
    GanttCurriculumModuleDayMapping,
    GanttEventRecurrenceException,
} from "@/api-shared/types/gantt/models";
import {
    MEAL_BREAKS_SYLLABUS_TITLE,
    MEAL_EVENT_TITLES,
} from "@/api-shared/types/settings/meal";
import {
    InsightContext,
    InsightDay,
    InsightEvent,
    InsightWeek,
} from "@/components/gantt/curriculum-view/components/insights/types";
import {
    computeEventDaySpans,
    getDayDate,
    getSpilloverMinutesByDay,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    calculateMinimumRequiredTimeForCurriculum,
    countEventOccurrences,
    RecurrenceOccurrenceContext,
} from "@/components/gantt/utils";

const MEAL_TITLES = new Set<string>(Object.values(MEAL_EVENT_TITLES));

export type BuildInsightContextInput = {
    curriculum: GanttCurriculumDocument;
    state: NormalizedStore;
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    exceptions: Record<string, GanttEventRecurrenceException>;
    now: Dayjs;
    instructorName: InsightContext["instructorName"];
    outsiderName: InsightContext["outsiderName"];
    execution: InsightContext["execution"];
};

function buildWeeks(
    curriculum: GanttCurriculumDocument,
    state: NormalizedStore,
    scheduledByDay: Record<string, number>,
): Array<InsightWeek> {
    const weeks: Array<InsightWeek> = [];
    curriculum.weeks.forEach((weekId, weekOrdinal) => {
        const week = state.weeks[weekId];
        if (!week) return;
        const days: Array<InsightDay> = week.days.flatMap((dayId) => {
            const day = state.days[dayId];
            if (!day) return [];
            return [ {
                id: dayId,
                dayIndex: day.dayIndex,
                weekNumber: week.number,
                capacityMinutes: day.totalWorkingMinutes ?? 0,
                scheduledMinutes: scheduledByDay[dayId] ?? 0,
                date: getDayDate(curriculum.startDate, weekOrdinal, day.dayIndex),
            } ];
        });
        weeks.push({
            id: weekId,
            number: week.number,
            weekendDuty: week.weekendDuty,
            days,
            capacityMinutes: days.reduce((sum, d) => sum + d.capacityMinutes, 0),
            scheduledMinutes: days.reduce((sum, d) => sum + d.scheduledMinutes, 0),
        });
    });
    return weeks;
}

function buildEvents(
    curriculum: GanttCurriculumDocument,
    state: NormalizedStore,
    occurrenceCtx: RecurrenceOccurrenceContext,
    placedEventIds: Set<string>,
    placedModuleIds: Set<string>,
): Array<InsightEvent> {
    const events: Array<InsightEvent> = [];
    for (const syllabusId of curriculum.syllabuses) {
        const syllabus = state.syllabuses[syllabusId];
        if (!syllabus) continue;
        const isBreakSyllabus = syllabus.title === MEAL_BREAKS_SYLLABUS_TITLE;
        for (const moduleId of syllabus.modules) {
            const moduleDoc = state.modules[moduleId];
            if (!moduleDoc) continue;
            for (const eventId of moduleDoc.events) {
                const event = state.events[eventId];
                if (!event) continue;
                const occurrences = countEventOccurrences(event, eventId, state, occurrenceCtx);
                events.push({
                    id: eventId,
                    event,
                    moduleTitle: moduleDoc.title,
                    syllabusTitle: syllabus.title,
                    isBreak: isBreakSyllabus || MEAL_TITLES.has(event.title),
                    isPlaced: placedEventIds.has(eventId) || placedModuleIds.has(moduleId),
                    occurrences,
                    totalMinutes: (event.minimumDuration ?? 0) * occurrences,
                });
            }
        }
    }
    return events;
}

/**
 * Derives the per-week/day load and a flat, annotated event list once, so the
 * ~40 generators each stay a cheap pass over precomputed arrays.
 */
export function buildInsightContext({
    curriculum,
    state,
    mappings,
    exceptions,
    now,
    instructorName,
    outsiderName,
    execution,
}: BuildInsightContextInput): InsightContext {
    const linearDays = curriculum.weeks.flatMap((weekId) => state.weeks[weekId]?.days ?? []);
    const spans = computeEventDaySpans({ mappings, state, linearDays });
    const weeks = buildWeeks(curriculum, state, getSpilloverMinutesByDay(spans));

    const placedModuleIds = new Set<string>();
    for (const mapping of Object.values(mappings)) {
        if (!mapping.eventId) placedModuleIds.add(mapping.moduleId);
    }
    const occurrenceCtx = { mappings, exceptions, linearDays };
    const events = buildEvents(
        curriculum,
        state,
        occurrenceCtx,
        new Set(Object.keys(spans)),
        placedModuleIds,
    );

    return {
        curriculum,
        state,
        weeks,
        days: weeks.flatMap((week) => week.days),
        events,
        workEvents: events.filter((e) => !e.isBreak),
        capacityMinutes: weeks.reduce((sum, w) => sum + w.capacityMinutes, 0),
        scheduledMinutes: weeks.reduce((sum, w) => sum + w.scheduledMinutes, 0),
        requiredMinutes: calculateMinimumRequiredTimeForCurriculum(curriculum, state, occurrenceCtx),
        now,
        instructorName,
        outsiderName,
        execution,
    };
}
