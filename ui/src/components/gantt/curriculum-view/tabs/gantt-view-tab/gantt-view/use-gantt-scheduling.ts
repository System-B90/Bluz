import { useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttCurriculum } from "@/api-shared/types/gantt/models";
import { withoutBreaks } from "@/components/gantt/curriculum-view/student-load";
import { useCurriculumStudentSchedule } from "@/components/gantt/curriculum-view/use-student-schedule";

// Multi-day spillover layout (which days each mapped event actually
// occupies) plus per-day scheduled time as a single student lives it: per
// course path, shuffles in parallel, recurring events on every echo (#105).
// Laid out over the whole timeline even while a week is zoomed, so a zoomed
// day shows the same load as the unzoomed one.
export const useGanttScheduling = ({
    curriculum,
    ignoreBreaks,
    state,
}: {
    curriculum: GanttCurriculum | undefined;
    /** Leave break events out of the per-day loads. */
    ignoreBreaks: boolean;
    state: NormalizedStore;
}) =>
{
    const schedule = useCurriculumStudentSchedule(curriculum, state);

    const studentLoadByDay = useMemo(
        () => (ignoreBreaks ? withoutBreaks(schedule.byDay) : schedule.byDay),
        [ ignoreBreaks, schedule.byDay ],
    );

    return {
        eventSpans: schedule.spans,
        studentLoadByDay,
        studentLoadWithBreaksByDay: schedule.byDay,
        studentPaths: schedule.paths,
    };
};
