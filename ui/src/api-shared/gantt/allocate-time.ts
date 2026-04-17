import { GanttCurriculumId, GanttEvent, GanttEventId, GanttModule } from "@/api-shared/types/gantt/curriculum";

type AllocateTimeToEventCallbackSync = (props: { eventId: GanttEventId, curriculumId: string, duration: number; }) => void;
type AllocateTimeToEventCallbackAsync = (props: { eventId: GanttEventId, curriculumId: string, duration: number; }) => Promise<void>;
export type AllocateTimeToEventCallback = AllocateTimeToEventCallbackAsync | AllocateTimeToEventCallbackSync;

export type AllocateTimeToModuleCallbackModuleEvents = Record<GanttEventId, Pick<GanttEvent, 'id' | 'minimumDuration'>>;

export type AllocateTimeToModuleProps<T extends AllocateTimeToEventCallback> = {
    module: Pick<GanttModule, 'events' | 'id'>;
    totalDuration: number;
    moduleEvents: AllocateTimeToModuleCallbackModuleEvents;
    curriculumId: GanttCurriculumId;
    allocateToEventCallback: T;
};

export function allocateTimeToModule(props: AllocateTimeToModuleProps<AllocateTimeToEventCallbackAsync>): Promise<void>;
export function allocateTimeToModule(props: AllocateTimeToModuleProps<AllocateTimeToEventCallbackSync>): void;

// Implementation
export async function allocateTimeToModule({
    module,
    totalDuration,
    moduleEvents,
    curriculumId,
    allocateToEventCallback,
}: AllocateTimeToModuleProps<AllocateTimeToEventCallback>): Promise<void>
{
    let remainingBudget = totalDuration;

    for (const eventId of module.events)
    {
        const event = moduleEvents[ eventId ];

        // Red Flag: If eventId doesn't exist in the map, the logic would crash.
        if (!event) continue;

        let allocation = 0;

        // Optimization: Handle the common case where budget is already 0
        if (remainingBudget <= 0)
        {
            allocation = 0;
        } else if (remainingBudget >= event.minimumDuration)
        {
            allocation = event.minimumDuration;
            remainingBudget -= event.minimumDuration;
        } else
        {
            allocation = remainingBudget;
            remainingBudget = 0;
        }

        // We await regardless; if the callback is sync, it resolves immediately.
        await allocateToEventCallback({
            eventId,
            curriculumId,
            duration: allocation,
        });
    }
}
