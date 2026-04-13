import { useCallback } from "react";
import { moduleEventApi } from "@/api-client/gant/api";
import { ModuleId, ModuleEventId, ModuleEvent, ModuleEventType } from "@/api-shared/types/gant/curriculum";
import { useCurriculumProviderActions } from "@/components/gant/state/provider";
import { withGantErrorHandling } from "@/components/gant/state/hooks/gant-funcs/WithGantErrorHandling";

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

    const removeEvent = useCallback(async (moduleId: ModuleId, eventId: ModuleEventId) =>
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

    return { createEvent, updateEvent, removeEvent, linkEventToModule } as const;
}
