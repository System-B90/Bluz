import {
    closestCenter,
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import {
    EVENT_ANCHOR_PREFIX,
    HIGHLIGHT_DURATION_MS,
} from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { groupSortableId, ModuleEventGroupRow } from "@/components/gantt/module-dialog/ModuleEventGroupRow";
import { ModuleEventView } from "@/components/gantt/module-dialog/ModuleEventView";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

function CreateModuleEventButton({ moduleId }: { moduleId: GanttModuleId }) {
    const { enqueueSnackbar } = useSnackbar();
    const { createEvent } = useModuleEventActions();
    const state = useCurriculumState();
    const clickHandler = useCallback(() => {
        const defaultOrchestratorId =
            state.modules[moduleId]?.defaultOrchestratorId ?? null;
        createEvent(
            "מופע חדש",
            moduleId,
            undefined,
            undefined,
            undefined,
            null,
            null,
            null,
            defaultOrchestratorId,
        ).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "יצירת המופע נכשלה!",
                error,
            ),
        );
    }, [moduleId, createEvent, enqueueSnackbar, state.modules]);

    return (
        <IconButton onClick={clickHandler} size="small">
            <AddIcon color="info" fontSize="small" />
        </IconButton>
    );
}

export function ModuleEventsView({
    moduleId,
    eventIds,
    focusEventId,
}: {
    moduleId: GanttModuleId;
    eventIds: Array<GanttEventId>;
    focusEventId?: GanttEventId | null;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { dispatch } = useCurriculumProviderActions();
    const state = useCurriculumState();

    const [highlightedEventId, setHighlightedEventId] =
        useState<GanttEventId | null>(null);
    const clearTimerRef = useRef<null | number>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(),
    );
    const toggleGroup = useCallback((groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    }, []);

    // When the dialog is opened from search targeting a specific event, scroll
    // it into view and briefly highlight it. The list lives behind a mount
    // transition, so retry across frames until the row exists.
    useEffect(() => {
        if (!focusEventId || !eventIds.includes(focusEventId)) return;

        let attempts = 0;
        let frameId = 0;
        const tryScroll = () => {
            const element = document.getElementById(
                `${EVENT_ANCHOR_PREFIX}${focusEventId}`,
            );
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                return;
            }
            if (attempts++ < 60) {
                frameId = window.requestAnimationFrame(tryScroll);
            }
        };
        frameId = window.requestAnimationFrame(tryScroll);

        if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = window.setTimeout(() => {
            setHighlightedEventId(null);
        }, HIGHLIGHT_DURATION_MS);
        queueMicrotask(() => setHighlightedEventId(focusEventId));

        return () => {
            window.cancelAnimationFrame(frameId);
            if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
        };
    }, [focusEventId, eventIds]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Top-level rows: a lone event, or a whole group (members in order).
    const blocks = useMemo(() => {
        const result: Array<{ id: string; groupId?: string; ids: Array<GanttEventId> }> = [];
        for (const eventId of eventIds) {
            const groupId = state.events[eventId]?.groupId;
            const existing = groupId ? result.find((b) => b.groupId === groupId) : undefined;
            if (existing) existing.ids.push(eventId);
            else if (groupId) result.push({ id: groupSortableId(groupId), groupId, ids: [eventId] });
            else result.push({ id: eventId, ids: [eventId] });
        }
        return result;
    }, [eventIds, state.events]);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const blockFrom = blocks.findIndex((b) => b.id === active.id);
            const blockTo = blocks.findIndex((b) => b.id === over.id);
            let newOrder: Array<GanttEventId>;
            if (blockFrom !== -1 && blockTo !== -1) {
                newOrder = arrayMove(blocks, blockFrom, blockTo).flatMap((b) => b.ids);
            } else {
                // Members only reorder within their own group.
                const from = eventIds.indexOf(active.id as GanttEventId);
                const to = eventIds.indexOf(over.id as GanttEventId);
                const groupId = state.events[active.id as GanttEventId]?.groupId;
                if (from === -1 || to === -1 || !groupId) return;
                if (state.events[over.id as GanttEventId]?.groupId !== groupId) return;
                newOrder = arrayMove(eventIds, from, to);
            }

            dispatch({ type: "REORDER_EVENTS", payload: { moduleId, eventIds: newOrder } });

            ganttApi
                .reorderEvents(moduleId, newOrder)
                .catch((error) =>
                {
                    // Put the rows back where the server still has them,
                    // or the list shows an order that never persisted.
                    dispatch({
                        type: "REORDER_EVENTS",
                        payload: { moduleId, eventIds },
                    });
                    enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת סדר המופעים נכשלה!", error);
                });
        },
        [blocks, dispatch, eventIds, moduleId, enqueueSnackbar, state.events],
    );

    return (
        <Box
            alignItems={"flex-end"}
            display={"flex"}
            flexGrow={1}
            flexWrap={"wrap"}
            gap={2}
            maxHeight={400}
            overflow={"auto"}
            sx={{ "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: "action.selected", borderRadius: 2 } }}
        >
            <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                sensors={sensors}
            >
                <Table size="small" stickyHeader={true} sx={{ flexGrow: 1 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: "1rem" }} />
                            <TableCell>
                                <Typography variant="h6">שם</Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="h6">סוג</Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="h6">
                                    זמן מינימלי
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Typography variant="h6">אחראי</Typography>
                            </TableCell>
                            <TableCell>
                                <CreateModuleEventButton moduleId={moduleId} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <SortableContext
                            items={blocks.map((b) => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {blocks.map(({ id, groupId, ids }) =>
                                groupId ? (
                                    <ModuleEventGroupRow
                                        eventIds={ids}
                                        expanded={expandedGroups.has(groupId)}
                                        groupId={groupId}
                                        highlightedEventId={highlightedEventId}
                                        key={id}
                                        moduleId={moduleId}
                                        onToggle={() => toggleGroup(groupId)}
                                    />
                                ) : (
                                    <ModuleEventView
                                        eventId={ids[0]}
                                        isHighlighted={ids[0] === highlightedEventId}
                                        key={id}
                                        moduleId={moduleId}
                                    />
                                ),
                            )}
                        </SortableContext>
                    </TableBody>
                </Table>
            </DndContext>
        </Box>
    );
}
