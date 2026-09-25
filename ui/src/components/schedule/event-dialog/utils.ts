import { CURRICULUM_QUERY_PARAM } from "@/api-shared/types/gantt/models";
import { ITERATION_QUERY_PARAM } from "@/api-shared/types/iteration";
import { GANTT_EVENT_DEEP_LINK_PARAM } from "@/components/gantt/state/context";
import { Event } from "@/components/schedule/types/event";

export type EventFieldProps = {
    event?: Partial<Event>;
    onBlurCallback: (event: Partial<Event>) => void;
};

/**
 * Builds the "go to gantt event" link. `gc` and `it` must both ride along
 * or the gantt page has no curriculum/iteration to load and `ge` is a
 * no-op (#…). Returns undefined when the event has no gantt curriculum
 * linkage — old cut events, or events never cut — so the caller can hide
 * the link entirely instead of shipping a dead one.
 */
export function buildGanttEventLink(
    event: Pick<Partial<Event>, "ganttCurriculumId" | "ganttEventId">,
    iterationId?: null | string,
): string | undefined {
    if (!event.ganttEventId || !event.ganttCurriculumId) return undefined;

    const params = new URLSearchParams({
        [GANTT_EVENT_DEEP_LINK_PARAM]: event.ganttEventId,
        [CURRICULUM_QUERY_PARAM]: event.ganttCurriculumId,
    });
    if (iterationId) params.set(ITERATION_QUERY_PARAM, iterationId);

    return `/gantt?${params.toString()}`;
}
