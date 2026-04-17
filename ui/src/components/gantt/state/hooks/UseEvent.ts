import { ModuleEventDocument } from "@/api-client/gantt/module-event";
import { ModuleEventId } from "@/api-shared/types/gantt/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useEvent(eventId: null): undefined;
export function useEvent(eventId: ModuleEventId): ModuleEventDocument | undefined;
export function useEvent(eventId: ModuleEventId | null): ModuleEventDocument | undefined
{
    const state = useCurriculumState();

    if (eventId === null)
    {
        return undefined;
    }

    return state.events[ eventId ];
}
