import { useCallback, useMemo } from "react";

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
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleEventActions() {
    const { dispatch } = useCurriculumProviderActions();

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
        [dispatch],
    );

    const createEvent = useCallback(
        (
            title: string,
            moduleId: GanttModuleId,
            type: ModuleEventType = ModuleEventType.Lecture,
            minimumDuration: number = 0,
            allocatedDuration: number = 0,
        ) =>
            actions.create(
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
            ),
        [actions],
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
                return duplicatedEvent;
            }, `Failed to duplicate event (ID: ${eventId}):`);
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
    } as const;
}
