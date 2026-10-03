import { DragEndEvent } from "@dnd-kit/core";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttDayId, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { DragLabels, dropMessages } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drag-labels";
import {
    ModuleMapping,
    moduleMappingsOf,
    planModuleMap,
    planModuleShift,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/module-drag";
import { UndoEntry, useGanttUndo } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo";
import { CreateMapping, MoveMapping, RemoveMapping } from "@/components/gantt/state/mappings/context";
import { DeleteOccurrence, RestoreOccurrence } from "@/components/gantt/state/recurrence-exceptions/context";

type UseGanttDragArgs = {
    linearDays: Array<GanttDayId>;
    modulesById: NormalizedStore[ "modules" ];
    moduleMappings: Record<string, Array<GanttDayId>>;
    eventMappings: Record<string, GanttDayId>;
    createMapping: CreateMapping;
    moveMapping: MoveMapping;
    removeMapping: RemoveMapping;
    deleteOccurrence: DeleteOccurrence;
    /** Undoes a dragged-off occurrence. Without it that drop can't be undone. */
    restoreOccurrence?: RestoreOccurrence;
    labels: DragLabels;
}
type Move = { eventId: GanttEventId | null; from: GanttDayId; to: GanttDayId };

const allOk = (results: Array<boolean>) => results.every(Boolean);

// Drag-and-drop committing for the gantt timeline: map, move, and shift
// handlers plus the dnd-kit onDragEnd dispatcher. Every drop becomes an
// UndoEntry (#142, #809), confirmed with a snackbar or explained when
// refused (#810). Extracted from UseGanttView.ts (#225).
export const useGanttDrag = ({
    linearDays,
    modulesById,
    moduleMappings,
    eventMappings,
    createMapping,
    moveMapping,
    removeMapping,
    deleteOccurrence,
    restoreOccurrence,
    labels,
}: UseGanttDragArgs) =>
{
    const { commit } = useGanttUndo();
    const { enqueueSnackbar } = useSnackbar();

    const placementOf = useCallback(
        (moduleId: GanttModuleId) => ({
            eventIds: modulesById[ moduleId ]?.events ?? [],
            eventMappings,
        }),
        [ modulesById, eventMappings ],
    );

    // createMapping resolves undefined when the server refused (and said why).
    const create = useCallback(
        async (moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId) =>
            (await createMapping({ moduleId, eventId, dayId })) !== undefined,
        [ createMapping ],
    );

    const remove = useCallback(
        (moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId) =>
            removeMapping({ moduleId, eventId, dayId }),
        [ removeMapping ],
    );

    // One at a time, in order: the server's (module, event, day) uniqueness
    // would otherwise reject a move onto a day a sibling still occupies.
    const runMoves = useCallback(
        async (moduleId: GanttModuleId, moves: Array<Move>) =>
        {
            for (const move of moves)
            {
                const ok = await moveMapping({
                    moduleId,
                    eventId: move.eventId,
                    from: { d: move.from },
                    to: { d: move.to },
                });
                if (!ok) return false;
            }
            return true;
        },
        [ moveMapping ],
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
            for (const eventId of eventIds) await create(moduleId, eventId, dayId);
            return eventIds;
        },
        [ placementOf, create ],
    );

    const handleMapEvent = useCallback(
        async (moduleId: GanttModuleId, eventId: GanttEventId, dayId: GanttDayId) =>
        {
            await create(moduleId, eventId, dayId);
        },
        [ create ],
    );

    const handleMoveModule = useCallback(
        async (moduleId: GanttModuleId, sourceDayId: GanttDayId, targetDayId: GanttDayId) =>
        {
            await runMoves(moduleId, [ { eventId: null, from: sourceDayId, to: targetDayId } ]);
        },
        [ runMoves ],
    );

    const handleMoveEvent = useCallback(
        async (
            moduleId: GanttModuleId,
            eventId: GanttEventId,
            sourceDayId: GanttDayId,
            targetDayId: GanttDayId,
        ) =>
        {
            await runMoves(moduleId, [ { eventId, from: sourceDayId, to: targetDayId } ]);
        },
        [ runMoves ],
    );

    const planShift = useCallback(
        (moduleId: GanttModuleId, deltaDays: number) => planModuleShift(
            moduleMappingsOf(placementOf(moduleId), moduleMappings[ moduleId ] ?? []),
            linearDays,
            deltaDays,
        ),
        [ placementOf, moduleMappings, linearDays ],
    );

    // Moves a module's allocated events relatively. All-or-nothing: returns
    // false (moving nothing) when an event would leave the timeline.
    const handleShiftModule = useCallback(
        async (moduleId: GanttModuleId, deltaDays: number): Promise<boolean> =>
        {
            if (deltaDays === 0) return false;
            const moves = planShift(moduleId, deltaDays);
            if (!moves || moves.length === 0) return false;
            return await runMoves(moduleId, moves);
        },
        [ planShift, runMoves ],
    );

    /**
     * The drop as an undoable action, a refusal to explain, or null when
     * the drop is a no-op. Undo and redo replay explicit days captured here,
     * never a re-plan against mappings that have since changed.
     */
    const planDrop = useCallback(
        (event: DragEndEvent): { refused: string } | null | UndoEntry =>
        {
            const payload = event.active.data.current;
            const target = event.over?.data.current;
            if (!payload || !target) return null;

            const name = labels.itemName(payload);

            if (target.targetType === "remove")
            {
                if (payload.type === "module-move" || payload.type === "module-shift")
                {
                    const moduleId: GanttModuleId = payload.moduleId;
                    const removed: Array<ModuleMapping> = [
                        ...moduleMappingsOf(placementOf(moduleId), []),
                        ...(moduleMappings[ moduleId ] ?? [])
                            .map((dayId) => ({ eventId: null, dayId })),
                    ];
                    if (removed.length === 0) return null;
                    const removeAll = async () => allOk(await Promise.all(
                        removed.map((r) => remove(moduleId, r.eventId, r.dayId)),
                    ));
                    return {
                        label: dropMessages.removed(name),
                        redo: removeAll,
                        undo: async () => allOk(await Promise.all(
                            removed.map((r) => create(moduleId, r.eventId, r.dayId)),
                        )),
                    };
                }
                if (payload.type === "event-move")
                {
                    const { moduleId, eventId, sourceDayId } = payload;
                    return {
                        label: dropMessages.removed(name),
                        redo: () => remove(moduleId, eventId, sourceDayId),
                        undo: () => create(moduleId, eventId, sourceDayId),
                    };
                }
                if (payload.type === "event-occurrence")
                {
                    const { eventId, dayId } = payload;
                    return {
                        label: dropMessages.occurrenceRemoved(name, labels.dayLabel(dayId)),
                        redo: async () => (await deleteOccurrence({ eventId, dayId })) !== undefined,
                        undo: async () => restoreOccurrence
                            ? await restoreOccurrence({ eventId, dayId })
                            : false,
                    };
                }
                return null;
            }

            const dayId: GanttDayId = target.dayId;
            const day = labels.dayLabel(dayId);

            if (payload.type === "module-map" && target.targetType === "module")
            {
                const moduleId: GanttModuleId = payload.moduleId;
                const placement = placementOf(moduleId);
                const eventIds: Array<GanttEventId | null> = placement.eventIds.length > 0
                    ? planModuleMap(placement)
                    : [ null ];
                return {
                    label: dropMessages.placed(name, day),
                    redo: async () =>
                    {
                        const results: Array<boolean> = [];
                        for (const eventId of eventIds) results.push(await create(moduleId, eventId, dayId));
                        return allOk(results);
                    },
                    undo: async () => allOk(await Promise.all(
                        eventIds.map((eventId) => remove(moduleId, eventId, dayId)),
                    )),
                };
            }
            if (payload.type === "event-map" && target.targetType === "event")
            {
                const { moduleId, eventId } = payload;
                return {
                    label: dropMessages.placed(name, day),
                    redo: () => create(moduleId, eventId, dayId),
                    undo: () => remove(moduleId, eventId, dayId),
                };
            }
            if (
                (payload.type === "module-move" && target.targetType === "module") ||
                (payload.type === "event-move" && target.targetType === "event")
            )
            {
                if (payload.sourceDayId === dayId) return null;
                const move: Move = {
                    eventId: payload.type === "event-move" ? payload.eventId : null,
                    from: payload.sourceDayId,
                    to: dayId,
                };
                const back: Move = { ...move, from: move.to, to: move.from };
                return {
                    label: dropMessages.moved(name, day),
                    redo: () => runMoves(payload.moduleId, [ move ]),
                    undo: () => runMoves(payload.moduleId, [ back ]),
                };
            }
            if (payload.type === "module-shift" && target.targetType === "module")
            {
                const deltaDays = linearDays.indexOf(dayId) - linearDays.indexOf(payload.sourceDayId);
                if (deltaDays === 0) return null;
                const moves = planShift(payload.moduleId, deltaDays);
                if (!moves) return { refused: dropMessages.shiftRefused(name) };
                if (moves.length === 0) return null;
                // Reversed: the other edge leads on the way back.
                const backMoves = moves
                    .map((m) => ({ eventId: m.eventId, from: m.to, to: m.from }))
                    .reverse();
                return {
                    label: dropMessages.moved(name, day),
                    redo: () => runMoves(payload.moduleId, moves),
                    undo: () => runMoves(payload.moduleId, backMoves),
                };
            }
            return null;
        },
        [
            labels,
            placementOf,
            moduleMappings,
            linearDays,
            planShift,
            create,
            remove,
            runMoves,
            deleteOccurrence,
            restoreOccurrence,
        ],
    );

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) =>
        {
            const plan = planDrop(event);
            if (!plan) return;
            if ("refused" in plan)
            {
                enqueueSnackbar(plan.refused, { variant: "warning" });
                return;
            }
            try
            {
                // A false step already reported its own error (the mapping
                // provider shows the server's reason) — just don't confirm it.
                if ((await plan.redo()) !== false) commit(plan);
            } catch (e)
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, dropMessages.failed, e);
            }
        },
        [ planDrop, enqueueSnackbar, commit ],
    );

    return {
        handleDragEnd,
        handleMapModule,
        handleMapEvent,
        handleMoveModule,
        handleMoveEvent,
        handleShiftModule,
        planShift,
    };
};
