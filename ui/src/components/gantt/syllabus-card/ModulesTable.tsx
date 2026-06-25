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
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableFooter from "@mui/material/TableFooter";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttModuleId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";
import { CreateModuleButton } from "@/components/gantt/syllabus-card/CreateModuleButton";
import { ModuleRow } from "@/components/gantt/syllabus-card/ModuleRow";

export type ModulesTableProps = {
    syllabusId: GanttSyllabusId;
    curriculumId: GanttCurriculumId;
    syllabusModules: GanttSyllabus["modules"];
};

export function ModulesTable({
    syllabusId,
    syllabusModules,
    curriculumId,
}: ModulesTableProps) {
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

            const oldIndex = syllabusModules.indexOf(active.id as GanttModuleId);
            const newIndex = syllabusModules.indexOf(over.id as GanttModuleId);
            if (oldIndex === -1 || newIndex === -1) return;

            const newOrder = arrayMove(syllabusModules, oldIndex, newIndex);

            dispatch({ type: "REORDER_MODULES", payload: { syllabusId, moduleIds: newOrder } });

            ganttApi
                .reorderModules(syllabusId, newOrder)
                .catch((error) =>
                    enqueueApiErrorSnackbar(enqueueSnackbar, "שמירת סדר המערכים נכשלה!", error),
                );
        },
        [dispatch, syllabusId, syllabusModules, enqueueSnackbar],
    );

    return (
        <Box
            sx={{
                overflowY: "auto",
                flexGrow: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 225,
                "&::-webkit-scrollbar": {
                    width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: "rgba(0, 0, 0, 0.1)",
                    borderRadius: "4px",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                },
            }}
        >
            <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                sensors={sensors}
            >
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: "1rem" }} />
                            <TableCell sx={{ fontWeight: "bold" }}>
                                שם המערך
                            </TableCell>
                            <TableCell sx={{ fontWeight: "bold" }}>
                                זמן רצוי
                            </TableCell>
                            <TableCell align="center" width="1rem">
                                <CreateModuleButton syllabusId={syllabusId} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <SortableContext items={syllabusModules} strategy={verticalListSortingStrategy}>
                            {syllabusModules.length > 0 ? (
                                syllabusModules.map((moduleId) => (
                                    <ModuleRow
                                        curriculumId={curriculumId}
                                        key={moduleId}
                                        moduleId={moduleId}
                                        syllabusId={syllabusId}
                                    />
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell align="center" colSpan={4}>
                                        <Typography
                                            color="textSecondary"
                                            variant="caption"
                                        >
                                            לא נמצאו מערכים. לחצו על הוסף כדי להתחיל.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </SortableContext>
                    </TableBody>
                    <TableFooter />
                </Table>
            </DndContext>
        </Box>
    );
}
