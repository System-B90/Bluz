import { useEffect, useMemo, useState } from "react";

import { apiGetCurriculum } from "@/api-client/gantt/curriculum";
import { useIterationScope } from "@/components/base/IterationProvider";
import { iterationWeekNumber } from "@/components/schedule/calendar/calendar/schedule-week";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";

/** Comments of the linked gantt's weeks, by week number. */
type WeekComments = { curriculumId: string; byNumber: Map<number, string> };

/**
 * The iteration week shown in the calendar (counted from the viewed
 * iteration's start date) and the comment of the same-numbered week in the
 * gantt curriculum linked to that iteration, if any.
 */
export function useScheduleWeek(date: Date): { number: null | number; comment: string }
{
    const { iterationId } = useCalendar();
    const { iterations, currentIterationId } = useIterationScope();
    const iteration = iterations.find((i) => i.id === (iterationId ?? currentIterationId));
    const curriculumId = iteration?.ganttCurriculumId;
    const [ comments, setComments ] = useState<null | WeekComments>(null);

    useEffect(() =>
    {
        if (!curriculumId) return;
        let cancelled = false;
        apiGetCurriculum(curriculumId, {})
            .then((curriculum) =>
            {
                if (cancelled) return;
                const byNumber = new Map(
                    curriculum.c2w.map(({ week }) => [ week.number, week.comment?.trim() ?? "" ]),
                );
                setComments({ curriculumId, byNumber });
            })
            // Comments are a nicety: without them the number shows alone.
            .catch(() => undefined);
        return () =>
        {
            cancelled = true;
        };
    }, [ curriculumId ]);

    const number = useMemo(() => iterationWeekNumber(date, iteration?.startDate), [ date, iteration?.startDate ]);
    const comment = number !== null && comments?.curriculumId === curriculumId
        ? comments?.byNumber.get(number) ?? ""
        : "";
    return { number, comment };
}
