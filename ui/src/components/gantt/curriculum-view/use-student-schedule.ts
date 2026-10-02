import { useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculum, GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models";
import { useCourses } from "@/components/base/CoursesProvider";
import { getDayDate } from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    calculateStudentMinutes,
    computeStudentSchedule,
    StudentSchedule,
    sumStudentMinutes,
} from "@/components/gantt/curriculum-view/student-load";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

export type CurriculumStudentSchedule = StudentSchedule & {
    /** A single student's scheduled minutes over the whole curriculum. */
    scheduledMinutes: number;
    /** A single student's minimum required minutes over the whole curriculum. */
    requiredMinutes: number;
};

const EMPTY_SCHEDULE: CurriculumStudentSchedule = {
    paths: [],
    spans: {},
    byDay: {},
    scheduledMinutes: 0,
    requiredMinutes: 0,
};

/**
 * The curriculum's schedule as a single student lives it, over the whole
 * timeline: every view that shows scheduled time reads it from here, so the
 * timeline, weeks grid and summaries always agree.
 */
export function useCurriculumStudentSchedule(
    curriculum: GanttCurriculum | undefined,
    state: NormalizedStore,
): CurriculumStudentSchedule {
    const { courses } = useCourses();
    const { state: { mappings } } = useGanttMappings();
    const { state: { exceptions } } = useGanttRecurrenceExceptions();

    return useMemo(() => {
        if (!curriculum) return EMPTY_SCHEDULE;
        const linearDays: Array<string> = [];
        const dateByDayId = new Map<string, string>();
        curriculum.weeks.forEach((weekId, weekIdx) => {
            for (const dayId of state.weeks[weekId]?.days ?? []) {
                linearDays.push(dayId);
                const day = state.days[dayId];
                const date = day ? getDayDate(curriculum.startDate, weekIdx, day.dayIndex) : null;
                if (date) dateByDayId.set(dayId, date.format("YYYY-MM-DD"));
            }
        });
        const curriculumMappings: Record<string, GanttCurriculumModuleDayMapping> = {};
        for (const [id, mapping] of Object.entries(mappings)) {
            if (mapping.curriculumId === curriculum.id) curriculumMappings[id] = mapping;
        }

        const schedule = computeStudentSchedule({
            courses,
            dateOf: (dayId) => dateByDayId.get(dayId),
            exceptions,
            linearDays,
            mappings: curriculumMappings,
            state,
            syllabusIds: curriculum.syllabuses,
        });
        return {
            ...schedule,
            scheduledMinutes: sumStudentMinutes(schedule.byDay, linearDays),
            requiredMinutes: calculateStudentMinutes({
                courses,
                occurrenceCtx: {
                    mappings: curriculumMappings,
                    exceptions,
                    linearDays,
                    dateOf: (dayId) => dateByDayId.get(dayId),
                },
                state,
                syllabusIds: curriculum.syllabuses,
            }),
        };
    }, [curriculum, state, courses, mappings, exceptions]);
}
