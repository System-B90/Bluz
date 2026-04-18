import { ModuleEventDocument } from "@/api-client/gantt/module-event";
import { GanttEventId } from "@/api-shared/types/gantt/models/curriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useEvent(eventId: null): undefined;
export function useEvent(
  eventId: GanttEventId,
): ModuleEventDocument | undefined;
export function useEvent(
  eventId: GanttEventId | null,
): ModuleEventDocument | undefined {
  const state = useCurriculumState();

  if (eventId === null) {
    return undefined;
  }

  return state.events[eventId];
}
