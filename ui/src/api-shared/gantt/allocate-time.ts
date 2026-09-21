import {
    GanttCurriculumId,
    GanttEvent,
    GanttEventId,
    GanttModule,
} from "@/api-shared/types/gantt/models";

type AllocateTimeToEventCallbackSync = (props: {
    eventId: GanttEventId;
    curriculumId: string;
    duration: number;
}) => void;
type AllocateTimeToEventCallbackAsync = (props: {
    eventId: GanttEventId;
    curriculumId: string;
    duration: number;
}) => Promise<void>;
export type AllocateTimeToEventCallback =
    | AllocateTimeToEventCallbackAsync
    | AllocateTimeToEventCallbackSync;

export type AllocateTimeToModuleCallbackModuleEvents = Record<
    GanttEventId,
    Pick<GanttEvent, "id" | "minimumDuration">
>;

export type AllocateTimeToModuleProps<T extends AllocateTimeToEventCallback> = {
    module: Pick<GanttModule, "events" | "id">;
    totalDuration: number;
    moduleEvents: AllocateTimeToModuleCallbackModuleEvents;
    curriculumId: GanttCurriculumId;
    allocateToEventCallback: T;
};

export type ModuleAllocation = { eventId: GanttEventId; duration: number };

/**
 * Pure, synchronous split of `totalDuration` across the module's events in
 * order, each taking up to its `minimumDuration`. The client reducer consumes
 * this directly: the async `allocateTimeToModule` wrapper only runs its first
 * iteration synchronously, so a reducer calling it returned before the
 * remaining events were updated.
 */
export function planModuleAllocation({
    module,
    totalDuration,
    moduleEvents,
}: Pick<
    AllocateTimeToModuleProps<AllocateTimeToEventCallback>,
    "module" | "moduleEvents" | "totalDuration"
>): Array<ModuleAllocation> {
    let remainingBudget = totalDuration;
    const allocations: Array<ModuleAllocation> = [];

    for (const eventId of module.events) {
        const event = moduleEvents[eventId];

        // Red Flag: If eventId doesn't exist in the map, the logic would crash.
        if (!event) continue;

        let allocation = 0;

        // Optimization: Handle the common case where budget is already 0
        if (remainingBudget <= 0) {
            allocation = 0;
        } else if (remainingBudget >= event.minimumDuration) {
            allocation = event.minimumDuration;
            remainingBudget -= event.minimumDuration;
        } else {
            allocation = remainingBudget;
            remainingBudget = 0;
        }

        allocations.push({ eventId, duration: allocation });
    }

    return allocations;
}

export function allocateTimeToModule(
    props: AllocateTimeToModuleProps<AllocateTimeToEventCallbackAsync>,
): Promise<void>;
export function allocateTimeToModule(
    props: AllocateTimeToModuleProps<AllocateTimeToEventCallbackSync>,
): void;

// Implementation
export async function allocateTimeToModule({
    module,
    totalDuration,
    moduleEvents,
    curriculumId,
    allocateToEventCallback,
}: AllocateTimeToModuleProps<AllocateTimeToEventCallback>): Promise<void> {
    for (const { eventId, duration } of planModuleAllocation({
        module,
        totalDuration,
        moduleEvents,
    })) {
        // We await regardless; if the callback is sync, it resolves immediately.
        await allocateToEventCallback({ eventId, curriculumId, duration });
    }
}
