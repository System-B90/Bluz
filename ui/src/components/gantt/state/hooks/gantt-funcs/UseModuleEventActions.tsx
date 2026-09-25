import { useCallback, useEffect, useMemo, useRef } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    defaultModuleEventSplitAcrossBreaks,
    EventRecurrence,
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";

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
    // `ALLOCATE_TIME` writes a single field, so a prior value is enough to
    // roll back — which makes event time allocation optimistic (#328).
    const getAllocatedTime = useCallback(
        (id: GanttEventId): number | undefined =>
            stateRef.current.events[id]?.allocatedDuration,
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
                getAllocatedTime,
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
                    discard: (eventId) => ({
                        type: "PURGE_ENTITY",
                        payload: { collection: "events", id: eventId },
                    }),
                    allocateTime: (eventId, curriculumId, duration) => ({
                        type: "ALLOCATE_TIME",
                        payload: { eventId, curriculumId, duration },
                    }),
                },
            }),
        [dispatch, getEntity, getAllocatedTime],
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
            hiveSubjectId: null | number = null,
            hiveModuleId: null | number = null,
            hiveLessonId: null | number = null,
            orchestratorId: null | number = null,
        ) =>
            actions
                .create(
                    {
                        title,
                        moduleId,
                        type,
                        minimumDuration,
                        allocatedDuration,
                        orchestratorId,
                        recommendedLecturerIds: [],
                        systemRequirements: [],
                        roomRequirement: RoomRequirement.Classified,
                        recurrence: EventRecurrence.None,
                        recurrenceStartDate: null,
                        recurrenceEndDate: null,
                        isCritical: false,
                        isPaWindow: false,
                        splitAcrossBreaks: defaultModuleEventSplitAcrossBreaks(type),
                        comment: null,
                        groupId: null,
                        hiveSubjectId,
                        hiveModuleId,
                        hiveLessonId,
                    },
                    moduleId,
                    (tempId): GanttEvent => ({
                        id: tempId,
                        title,
                        type,
                        minimumDuration,
                        allocatedDuration,
                        orchestratorId,
                        recommendedLecturerIds: [],
                        systemRequirements: [],
                        roomRequirement: RoomRequirement.Classified,
                        recurrence: EventRecurrence.None,
                        recurrenceStartDate: null,
                        recurrenceEndDate: null,
                        isCritical: false,
                        isPaWindow: false,
                        splitAcrossBreaks: defaultModuleEventSplitAcrossBreaks(type),
                        comment: null,
                        constraints: [],
                        groupId: null,
                        hiveSubjectId,
                        hiveModuleId,
                        hiveLessonId,
                    }),
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

    /**
     * Makes the event's shuffle group cover exactly `shuffles`: one sibling
     * event per shuffle, so the same lesson can sit at a different time for
     * each of them (#699). Fewer than two shuffles ungroups the event.
     */
    const applyEventShuffleGroup = useCallback(
        async (
            eventId: GanttEventId,
            moduleId: GanttModuleId,
            shuffles: Array<string>,
        ) => {
            return await withGantErrorHandling(async () => {
                const { members, removedIds } =
                    await ganttApi.event.apiApplyShuffleGroup(
                        eventId,
                        moduleId,
                        shuffles,
                    );

                for (const removedId of removedIds) {
                    dispatch({
                        type: "REMOVE_EVENT",
                        payload: { moduleId, eventId: removedId },
                    });
                }
                for (const member of members) {
                    // Members that already existed are updated in place; the
                    // reducer's ADD_EVENT would append them to the module a
                    // second time.
                    if (stateRef.current.events[member.id]) {
                        dispatch({
                            type: "UPDATE_EVENT",
                            payload: { id: member.id, updates: member },
                        });
                    } else {
                        dispatch({
                            type: "ADD_EVENT",
                            payload: { event: member, moduleId },
                        });
                    }
                }

                return members;
            }, `Failed to group event (ID: ${eventId}) across shuffles:`);
        },
        [dispatch],
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
        applyEventShuffleGroup,
    } as const;
}
