import { useCallback } from "react";

import { moduleEventApi } from "@/api-client/gantt/api";
import { CurriculumId, ModuleEvent, ModuleEventId, ModuleEventType, ModuleId } from "@/api-shared/types/gantt/curriculum";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gant-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleEventActions()
{
    const { dispatch } = useCurriculumProviderActions();

    const createEvent = useCallback(async (
        title: string,
        moduleId: ModuleId,
        type: ModuleEventType = ModuleEventType.Lecture,
        minimumDuration: number = 0,
        allocatedDuration: number = 0
    ) =>
    {
        return withGantErrorHandling(async () =>
        {
            const newEvent = await moduleEventApi.apiCreate({
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

    const updateEvent = useCallback(async (id: ModuleEventId, updates: Partial<ModuleEvent>) =>
    {
        return withGantErrorHandling(async () =>
        {
            const updatedEvent = await moduleEventApi.apiUpdate({ id, ...updates });
            dispatch({ type: 'UPDATE_EVENT', payload: { id, updates: updatedEvent } });
            return updatedEvent;
        }, `Failed to update event (ID: ${id}):`);
    }, [ dispatch ]);

    const deleteEvent = useCallback(async (moduleId: ModuleId, eventId: ModuleEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleEventApi.apiDelete(eventId);
            dispatch({ type: 'REMOVE_EVENT', payload: { moduleId, eventId } });
        }, `Failed to remove event (ID: ${eventId}):`);
    }, [ dispatch ]);

    const linkEventToModule = useCallback(async (moduleId: ModuleId, eventId: ModuleEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            const linkedEvent = await moduleEventApi.apiLink(eventId, moduleId);
            dispatch({ type: 'ADD_EVENT', payload: { event: linkedEvent, moduleId } });
            return linkedEvent;
        }, `Failed to link event (ID: ${eventId}) to module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const unlinkEventFromModule = useCallback(async (moduleId: ModuleId, eventId: ModuleEventId) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleEventApi.apiUnlink(eventId, moduleId);
            dispatch({ type: 'REMOVE_EVENT', payload: { eventId, moduleId } });
        }, `Failed to unlink event (ID: ${eventId}) from module (ID: ${moduleId}):`);
    }, [ dispatch ]);

    const allocateTimeToModuleEvent = useCallback(async (eventId: ModuleEventId, curriculumId: CurriculumId, allocatedDuration: number) =>
    {
        return withGantErrorHandling(async () =>
        {
            await moduleEventApi.apiSetAllocatedTime(eventId, curriculumId, allocatedDuration);
            dispatch({ type: 'ALLOCATE_TIME', payload: { eventId, curriculumId, duration: allocatedDuration } });
        }, `Failed to allocate time to event (ID: ${eventId}):`);
    }, [ dispatch ]);

    return { createEvent, updateEvent, deleteEvent, linkEventToModule, unlinkEventFromModule, allocateTimeToModuleEvent } as const;
}
