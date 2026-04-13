import { ModuleEventDocument } from "@/api-client/gant/module-event";
import { ModuleEventId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumState } from "@/components/gant/state/provider";

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
