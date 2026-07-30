import { DragEndEvent } from "@dnd-kit/core";
import { useCallback } from "react";

import { GanttDayId, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { useGanttUndo } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { CreateMapping, MoveMapping, RemoveMapping } from "@/components/gantt/state/mappings/context";
import { DeleteOccurrence } from "@/components/gantt/state/recurrence-exceptions/context";

interface UseGanttDragArgs
{
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

    const handleMapModule = useCallback(
        async (moduleId: GanttModuleId, dayId: GanttDayId) =>
        {
            await createMapping({ moduleId, eventId: null, dayId });
        },
        [ createMapping ],
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

    const handleShiftModule = useCallback(
        async (moduleId: GanttModuleId, deltaDays: number) =>
        {
            if (deltaDays === 0) return;

            const ganttModule = modulesById[ moduleId ];
            const promises: Array<Promise<void>> = [];

            const mDays = moduleMappings[ moduleId ] || [];
            mDays.forEach((dayId) =>
            {
                const currentIdx = linearDays.indexOf(dayId);
                const newIdx = currentIdx + deltaDays;
                const targetDayId = linearDays[ newIdx ];
                if (targetDayId)
                {
                    promises.push(
                        moveMapping({
                            moduleId,
                            eventId: null,
                            from: { d: dayId },
                            to: { d: targetDayId },
                        }),
                    );
                }
            });

            if (ganttModule && ganttModule.events)
            {
                ganttModule.events.forEach((eventId) =>
                {
                    const currentDayId = eventMappings[ eventId ];
                    if (currentDayId)
                    {
                        const currentIdx = linearDays.indexOf(currentDayId);
                        const newIdx = currentIdx + deltaDays;
                        const targetDayId = linearDays[ newIdx ];
                        if (targetDayId)
                        {
                            promises.push(
                                moveMapping({
                                    moduleId,
                                    eventId,
                                    from: { d: currentDayId },
                                    to: { d: targetDayId },
                                }),
                            );
                        }
                    }
                });
            }

            await Promise.all(promises);
        },
        [ linearDays, modulesById, moduleMappings, eventMappings, moveMapping ],
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
                    const mDays = moduleMappings[ payload.moduleId ] || [];
                    const promises: Array<Promise<void>> = [];
                    // Snapshot for undo: everything this drop removes (#142).
                    const removed: Array<{
                        eventId: null | string;
                        dayId: string;
                    }> = [];

                    mDays.forEach((d) =>
                    {
                        removed.push({ eventId: null, dayId: d });
                        promises.push(
                            removeMapping({
                                moduleId: payload.moduleId,
                                eventId: null,
                                dayId: d,
                            }),
                        );
                    });

                    const ganttModule = modulesById[ payload.moduleId ];
                    if (ganttModule && ganttModule.events)
                    {
                        ganttModule.events.forEach((eId) =>
                        {
                            const d = eventMappings[ eId ];
                            if (d)
                            {
                                removed.push({ eventId: eId, dayId: d });
                                promises.push(
                                    removeMapping({
                                        moduleId: payload.moduleId,
                                        eventId: eId,
                                        dayId: d,
                                    }),
                                );
                            }
                        });
                    }
                    await Promise.all(promises);
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
                await handleMapModule(payload.moduleId, target.dayId);
                pushUndo(async () =>
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: null,
                        dayId: target.dayId,
                    });
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

                if (deltaDays !== 0)
                {
                    await handleShiftModule(payload.moduleId, deltaDays);
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
            eventMappings,
            removeMapping,
            createMapping,
            pushUndo,
            deleteOccurrence,
            modulesById,
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
