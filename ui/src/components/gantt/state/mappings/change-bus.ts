import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

type Listener = (curriculumId: GanttCurriculumId) => void;

const listeners = new Set<Listener>();

/**
 * Lets a mapping write made *outside* `GanttMappingProvider` (the event
 * dialog's שבוע/יום picker, which mounts at the curriculum root) tell a
 * mounted provider to refetch. Without it the רצף זמן tab kept drawing the
 * old placement until a reload, so a mapping changed from the dialog looked
 * like it had not taken.
 * @param curriculumId The curriculum whose mappings changed.
 */
export function notifyMappingsChanged(curriculumId: GanttCurriculumId): void
{
    listeners.forEach((listener) => listener(curriculumId));
}

/**
 * Subscribes to {@link notifyMappingsChanged}.
 * @param listener Called with the curriculum id on every notification.
 * @returns Unsubscribe.
 */
export function onMappingsChanged(listener: Listener): () => void
{
    listeners.add(listener);
    return () => listeners.delete(listener);
}
