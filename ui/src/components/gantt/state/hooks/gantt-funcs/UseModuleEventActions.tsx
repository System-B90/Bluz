import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumId, GanttEvent, GanttEventId, GanttModuleId, ModuleEventType } from "@/api-shared/types/gantt/curriculum";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleEventActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const createEvent = useCallback(async (
        title: string,
        moduleId: GanttModuleId,
        type: ModuleEventType = ModuleEventType.Lecture,
        minimumDuration: number = 0,
        allocatedDuration: number = 0
    ) =>
    {
        return withGantErrorHandling(async () =>
        {
            const newEvent = await ganttApi.event.apiCreate({
                title,
                moduleId,
                type,
                minimumDuration,
                allocatedDuration,
                requirements: []
            });
            dispatch({ type: 'ADD_EVENT', payload: { event: newEvent, moduleId } });
            return newEvent;
        }, "Failed to create event:");
    }, [ dispatch ]);

    const updateEvent = useCallback(async (id: GanttEventId, updates: Partial<GanttEvent>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedEvent = await ganttApi.event.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_EVENT', payload: { id, updates: updatedEvent } });
            return updatedEvent;
        }, `Failed to update event (ID: ${id}):`);
    }, [ dispatch ]);

    const deleteEvent = useCallback(async (moduleId: GanttModuleId, eventId: GanttEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await ganttApi.event.apiDelete(eventId);
            dispatch({ type: 'REMOVE_EVENT', payload: { moduleId, eventId } });
        }, `Failed to remove event (ID: ${eventId}):`);
    }, [ dispatch ]);

    const linkEventToModule = useCallback(async (moduleId: GanttModuleId, eventId: GanttEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            const linkedEvent = await ganttApi.event.apiLink(eventId, moduleId);
            dispatch({ type: 'ADD_EVENT', payload: { event: linkedEvent, moduleId } });
            return linkedEvent;
        }, `Failed to link event (ID: ${eventId}) to module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const unlinkEventFromModule = useCallback(async (moduleId: GanttModuleId, eventId: GanttEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await ganttApi.event.apiUnlink(eventId, moduleId);
            dispatch({ type: 'REMOVE_EVENT', payload: { eventId, moduleId } });
        }, `Failed to unlink event (ID: ${eventId}) from module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const allocateTimeToModuleEvent = useCallback(async (eventId: GanttEventId, curriculumId: GanttCurriculumId, allocatedDuration: number) =>
    {
        return withGantErrorHandling(async () =>
        {
            await ganttApi.event.apiSetAllocatedTime(eventId, curriculumId, allocatedDuration);
            dispatch({ type: 'ALLOCATE_TIME', payload: { eventId, curriculumId, duration: allocatedDuration } });
        }, `Failed to allocate time to event (ID: ${eventId}):`);
    }, [ dispatch ]);

    return { createEvent, updateEvent, deleteEvent, linkEventToModule, unlinkEventFromModule, allocateTimeToModuleEvent } as const;
}
