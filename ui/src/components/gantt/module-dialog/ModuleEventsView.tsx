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
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { ModuleEventView } from "@/components/gantt/module-dialog/ModuleEventView";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

function CreateModuleEventButton({ moduleId }: { moduleId: GanttModuleId }) {
    const { enqueueSnackbar } = useSnackbar();
    const { createEvent } = useModuleEventActions();
    const clickHandler = useCallback(() => {
        createEvent("מופע חדש", moduleId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "יצירת המופע נכשלה!",
                error,
            ),
        );
    }, [moduleId, createEvent, enqueueSnackbar]);

    return (
        <IconButton onClick={clickHandler} size="small">
            <AddIcon color="info" fontSize="small" />
        </IconButton>
    );
}

export function ModuleEventsView({
    moduleId,
    eventIds,
}: {
    moduleId: GanttModuleId;
    eventIds: Array<GanttEventId>;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { dispatch } = useCurriculumProviderActions();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = eventIds.indexOf(active.id as GanttEventId);
            const newIndex = eventIds.indexOf(over.id as GanttEventId);
            if (oldIndex === -1 || newIndex === -1) return;

            const newOrder = arrayMove(eventIds, oldIndex, newIndex);

            dispatch({ type: "REORDER_EVENTS", payload: { moduleId, eventIds: newOrder } });

            ganttApi
                .reorderEvents(moduleId, newOrder)
                .catch((error) =>
                    enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת סדר המופעים נכשלה!", error),
                );
        },
        [dispatch, eventIds, moduleId, enqueueSnackbar],
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
                                    זמן מינימלי (דק&apos;)
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <CreateModuleEventButton moduleId={moduleId} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <SortableContext items={eventIds} strategy={verticalListSortingStrategy}>
                            {eventIds.map((eventId) => (
                                <ModuleEventView
                                    eventId={eventId}
                                    key={eventId}
                                    moduleId={moduleId}
                                />
                            ))}
                        </SortableContext>
                    </TableBody>
                </Table>
            </DndContext>
        </Box>
    );
}
