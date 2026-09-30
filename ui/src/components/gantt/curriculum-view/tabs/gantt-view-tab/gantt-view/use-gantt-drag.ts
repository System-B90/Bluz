import { DragEndEvent } from "@dnd-kit/core";
import { useCallback } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttDayId, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ModuleMapping,
    moduleMappingsOf,
    planModuleMap,
    planModuleShift,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-drag";
import { useGanttUndo } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo";
import { CreateMapping, MoveMapping, RemoveMapping } from "@/components/gantt/state/mappings/context";
import { DeleteOccurrence } from "@/components/gantt/state/recurrence-exceptions/context";

type UseGanttDragArgs = {
    linearDays: Array<GanttDayId>;
    modulesById: NormalizedStore[ "modules" ];
    moduleMappings: Record<string, Array<GanttDayId>>;
    eventMappings: Record<string, GanttDayId>;
    createMapping: CreateMapping;
    moveMapping: MoveMapping;
    removeMapping: RemoveMapping;
    deleteOccurrence: DeleteOccurrence;
}

// Drag-and-drop measuring/committing for the gantt timeline: map, move, and
// shift handlers plus the dnd-kit onDragEnd dispatcher, each paired with its
// undo inverse (#142). Extracted from UseGanttView.ts (#225).
export const useGanttDrag = ({
    linearDays,
    modulesById,
    moduleMappings,
    eventMappings,
    createMapping,
    moveMapping,
    removeMapping,
    deleteOccurrence,
}: UseGanttDragArgs) =>
{
    const { pushUndo } = useGanttUndo();

    const placementOf = useCallback(
        (moduleId: GanttModuleId) => ({
            eventIds: modulesById[ moduleId ]?.events ?? [],
            eventMappings,
        }),
        [ modulesById, eventMappings ],
    );

    // Maps a module to a day: every unallocated event lands there. An
    // event-less module is placed by a module-level mapping instead.
    // Returns the mappings it created, for undo.
    const handleMapModule = useCallback(
        async (moduleId: GanttModuleId, dayId: GanttDayId): Promise<Array<GanttEventId | null>> =>
        {
            const placement = placementOf(moduleId);
            const eventIds: Array<GanttEventId | null> = placement.eventIds.length > 0
                ? planModuleMap(placement)
                : [ null ];
            for (const eventId of eventIds) await createMapping({ moduleId, eventId, dayId });
            return eventIds;
        },
        [ placementOf, createMapping ],
    );

    const handleMapEvent = useCallback(
        async (moduleId: GanttModuleId, eventId: GanttEventId, dayId: GanttDayId) =>
        {
            await createMapping({ moduleId, eventId, dayId });
        },
        [ createMapping ],
    );

    const handleMoveModule = useCallback(
        async (moduleId: GanttModuleId, sourceDayId: GanttDayId, targetDayId: GanttDayId) =>
        {
            await moveMapping({
                moduleId,
                eventId: null,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [ moveMapping ],
    );

    const handleMoveEvent = useCallback(
        async (
            moduleId: GanttModuleId,
            eventId: GanttEventId,
            sourceDayId: GanttDayId,
            targetDayId: GanttDayId,
        ) =>
        {
            await moveMapping({
                moduleId,
                eventId,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [ moveMapping ],
    );

    // Moves a module's allocated events relatively. All-or-nothing: returns
    // false (moving nothing) when an event would leave the timeline.
    const handleShiftModule = useCallback(
        async (moduleId: GanttModuleId, deltaDays: number): Promise<boolean> =>
        {
            if (deltaDays === 0) return false;
            const moves = planModuleShift(
                moduleMappingsOf(placementOf(moduleId), moduleMappings[ moduleId ] ?? []),
                linearDays,
                deltaDays,
            );
            if (!moves || moves.length === 0) return false;

            // One at a time, leading edge first: the server's (module, event,
            // day) uniqueness would otherwise reject a move onto a day a
            // sibling still occupies, leaving the module torn.
            for (const move of moves)
            {
                await moveMapping({
                    moduleId,
                    eventId: move.eventId,
                    from: { d: move.from },
                    to: { d: move.to },
                });
            }
            return true;
        },
        [ placementOf, linearDays, moduleMappings, moveMapping ],
    );

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) =>
        {
            const { active, over } = event;
            if (!over) return;

            const payload = active.data.current;
            const target = over.data.current;

            if (!payload || !target) return;

            if (target.targetType === "remove")
            {
                if (
                    payload.type === "module-move" ||
                    payload.type === "module-shift"
                )
                {
                    // Every event leaves the timeline, plus any module-level
                    // mapping. Snapshot for undo (#142).
                    const removed: Array<ModuleMapping> = [
                        ...moduleMappingsOf(placementOf(payload.moduleId), []),
                        ...(moduleMappings[ payload.moduleId ] ?? [])
                            .map((dayId) => ({ eventId: null, dayId })),
                    ];
                    await Promise.all(
                        removed.map((r) =>
                            removeMapping({ moduleId: payload.moduleId, ...r }),
                        ),
                    );
                    if (removed.length > 0)
                    {
                        pushUndo(async () =>
                        {
                            await Promise.all(
                                removed.map((r) =>
                                    createMapping({
                                        moduleId: payload.moduleId,
                                        eventId: r.eventId,
                                        dayId: r.dayId,
                                    }),
                                ),
                            );
                        });
                    }
                } else if (payload.type === "event-move")
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: payload.eventId,
                        dayId: payload.sourceDayId,
                    });
                    pushUndo(async () =>
                    {
                        await createMapping({
                            moduleId: payload.moduleId,
                            eventId: payload.eventId,
                            dayId: payload.sourceDayId,
                        });
                    });
                } else if (payload.type === "event-occurrence")
                {
                    await deleteOccurrence({
                        eventId: payload.eventId,
                        dayId: payload.dayId,
                    });
                }
                return;
            }

            if (
                payload.type === "module-map" &&
                target.targetType === "module"
            )
            {
                const mapped = await handleMapModule(payload.moduleId, target.dayId);
                pushUndo(async () =>
                {
                    await Promise.all(
                        mapped.map((eventId) =>
                            removeMapping({
                                moduleId: payload.moduleId,
                                eventId,
                                dayId: target.dayId,
                            }),
                        ),
                    );
                });
            } else if (
                payload.type === "event-map" &&
                target.targetType === "event"
            )
            {
                await handleMapEvent(
                    payload.moduleId,
                    payload.eventId,
                    target.dayId,
                );
                pushUndo(async () =>
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: payload.eventId,
                        dayId: target.dayId,
                    });
                });
            } else if (
                payload.type === "module-move" &&
                target.targetType === "module"
            )
            {
                if (payload.sourceDayId !== target.dayId)
                {
                    await handleMoveModule(
                        payload.moduleId,
                        payload.sourceDayId,
                        target.dayId,
                    );
                    pushUndo(async () =>
                    {
                        await handleMoveModule(
                            payload.moduleId,
                            target.dayId,
                            payload.sourceDayId,
                        );
                    });
                }
            } else if (
                payload.type === "module-shift" &&
                target.targetType === "module"
            )
            {
                const sourceIdx = linearDays.indexOf(payload.sourceDayId);
                const targetIdx = linearDays.indexOf(target.dayId);
                const deltaDays = targetIdx - sourceIdx;

                if (await handleShiftModule(payload.moduleId, deltaDays))
                {
                    pushUndo(async () =>
                    {
                        await handleShiftModule(payload.moduleId, -deltaDays);
                    });
                }
            } else if (
                payload.type === "event-move" &&
                target.targetType === "event"
            )
            {
                if (payload.sourceDayId !== target.dayId)
                {
                    await handleMoveEvent(
                        payload.moduleId,
                        payload.eventId,
                        payload.sourceDayId,
                        target.dayId,
                    );
                    pushUndo(async () =>
                    {
                        await handleMoveEvent(
                            payload.moduleId,
                            payload.eventId,
                            target.dayId,
                            payload.sourceDayId,
                        );
                    });
                }
            }
        },
        [
            handleMapModule,
            handleMapEvent,
            handleMoveModule,
            handleMoveEvent,
            handleShiftModule,
            linearDays,
            moduleMappings,
            placementOf,
            removeMapping,
            createMapping,
            pushUndo,
            deleteOccurrence,
        ],
    );

    return {
        handleDragEnd,
        handleMapModule,
        handleMapEvent,
        handleMoveModule,
        handleMoveEvent,
        handleShiftModule,
    };
};
