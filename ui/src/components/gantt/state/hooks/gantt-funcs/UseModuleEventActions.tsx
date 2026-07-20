import { useCallback, useEffect, useMemo, useRef } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    EventRecurrence,
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

export function useModuleEventActions() {
    const { dispatch, requestReveal } = useCurriculumProviderActions();

    // Ref-backed store read so optimistic updates can snapshot current values
    // without recreating the memoized actions each render (#327).
    const state = useCurriculumState();
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    const getEntity = useCallback(
        (id: GanttEventId): GanttEvent | undefined =>
            stateRef.current.events[id],
        [],
    );

    const actions = useMemo(
        () =>
            makeEntityActions<
                GanttEvent,
                GanttModuleId,
                CreateGanttEventPayload
            >({
                api: ganttApi.event,
                dispatch,
                label: "event",
                containerLabel: "module",
                getEntity,
                builders: {
                    add: (event, moduleId) => ({
                        type: "ADD_EVENT",
                        payload: { event, moduleId },
                    }),
                    update: (id, updates) => ({
                        type: "UPDATE_EVENT",
                        payload: { id, updates },
                    }),
                    remove: (moduleId, eventId) => ({
                        type: "REMOVE_EVENT",
                        payload: { moduleId, eventId },
                    }),
                    allocateTime: (eventId, curriculumId, duration) => ({
                        type: "ALLOCATE_TIME",
                        payload: { eventId, curriculumId, duration },
                    }),
                },
            }),
        [dispatch, getEntity],
    );

    // Scroll-to + flash a freshly created/duplicated event in the timeline,
    // reusing the Gantt view's reveal mechanism (#325). No-op when the event's
    // syllabus can't be resolved (e.g. store not yet populated).
    const revealCreatedEvent = useCallback(
        (moduleId: GanttModuleId, eventId?: GanttEventId) => {
            if (!eventId) return;
            const syllabusId = stateRef.current.modules[moduleId]?.syllabusId;
            if (syllabusId) requestReveal(syllabusId, moduleId, eventId);
        },
        [requestReveal],
    );

    const createEvent = useCallback(
        (
            title: string,
            moduleId: GanttModuleId,
            type: ModuleEventType = ModuleEventType.Lecture,
            minimumDuration: number = 0,
            allocatedDuration: number = 0,
        ) =>
            actions
                .create(
                    {
                        title,
                        moduleId,
                        type,
                        minimumDuration,
                        allocatedDuration,
                        orchestratorId: null,
                        recommendedLecturerIds: [],
                        systemRequirements: [],
                        roomRequirement: RoomRequirement.Classified,
                        recurrence: EventRecurrence.None,
                        isCritical: false,
                        isPaWindow: false,
                        comment: null,
                        hiveSubjectId: null,
                        hiveModuleId: null,
                        hiveLessonId: null,
                    },
                    moduleId,
                )
                .then((event) => {
                    revealCreatedEvent(moduleId, event?.id);
                    return event;
                }),
        [actions, revealCreatedEvent],
    );

    const duplicateEvent = useCallback(
        async (eventId: GanttEventId, moduleId: GanttModuleId) => {
            return await withGantErrorHandling(async () => {
                const duplicatedEvent = await ganttApi.event.apiDuplicate(
                    eventId,
                    moduleId,
                );
                dispatch({
                    type: "ADD_EVENT",
                    payload: { event: duplicatedEvent, moduleId },
                });
                revealCreatedEvent(moduleId, duplicatedEvent?.id);
                return duplicatedEvent;
            }, `Failed to duplicate event (ID: ${eventId}):`);
        },
        [dispatch, revealCreatedEvent],
    );

    const moveEvent = useCallback(
        async (
            eventId: GanttEventId,
            fromModuleId: GanttModuleId,
            toModuleId: GanttModuleId,
        ) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.event.apiUnlink(eventId, fromModuleId);
                await ganttApi.event.apiLink(eventId, toModuleId);
                dispatch({
                    type: "MOVE_EVENT",
                    payload: { eventId, fromModuleId, toModuleId },
                });
            }, `Failed to move event (ID: ${eventId}):`);
        },
        [dispatch],
    );

    return {
        createEvent,
        updateEvent: actions.update,
        deleteEvent: actions.remove,
        linkEventToModule: actions.link,
        unlinkEventFromModule: actions.unlink,
        allocateTimeToModuleEvent: actions.allocateTime,
        duplicateEvent,
        moveEvent,
    } as const;
}
