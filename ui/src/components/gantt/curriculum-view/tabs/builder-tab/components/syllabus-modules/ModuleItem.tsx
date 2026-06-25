/**
 * Name: ModuleItem.tsx
 * Purpose: Draggable module item with placeholder logic for DragOverlay support.
 *          In the sidebar (no dayId + syllabusId provided), it behaves as a sortable item.
 *          In week panels (dayId provided), it behaves as a draggable for week assignment.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Paper, { PaperProps } from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { GanttDayId, GanttModuleId, GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { DndDragEventActiveData } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/dnd-types";
import { hashSyllabusToColor } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/utils";
import { WorkTimeChip } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { useSyllabusNames } from "@/components/gantt/state/providers/SyllabusNamesProvider";
import { calculateMinimumRequiredTimeForModule } from "@/components/gantt/utils";

export type ModuleItemProps = {
    moduleId: GanttModuleId;
    dayId?: GanttDayId;
    /** When set, the item is in the sidebar and participates in sort-within-syllabus */
    syllabusId?: GanttSyllabusId;
} & PaperProps;

// Sidebar sort variant
function SortableModuleItem({
    moduleId,
    syllabusId,
    ...props
}: ModuleItemProps & { syllabusId: GanttSyllabusId }) {
    const theme = useTheme();
    const state = useCurriculumState();
    const { syllabusNames } = useSyllabusNames();
    const moduleDoc = useModule(moduleId);
    const color = useMemo(
        () =>
            syllabusId
                ? hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2)
                : undefined,
        [syllabusId, theme.palette.primary.main],
    );
    const syllabusTitle = useMemo(
        () => (syllabusId ? syllabusNames[syllabusId] : "סילבוס"),
        [syllabusId, syllabusNames],
    );
    const totalHours = useMemo(
        () =>
            moduleDoc
                ? calculateMinimumRequiredTimeForModule(moduleDoc, state) / 60
                : 0,
        [moduleDoc, state],
    );

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: moduleId,
        data: {
            type: "SORT_MODULE",
            moduleId,
            syllabusId,
        } as DndDragEventActiveData,
    });

    const style = {
        ...props.style,
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <Paper
            {...props}
            className={`flex flex-row justify-between items-center
                p-2 border border-solid border-slate-200
                hover:border-blue-400 hover:bg-blue-50 transition-all
                touch-none
                ${props.className ?? ""}
                ${isDragging ? "opacity-0 pointer-events-none" : "opacity-100"}
            `}
            elevation={isDragging ? 4 : 0}
            ref={setNodeRef}
            style={style}
            sx={{ ...props.sx, backgroundColor: color }}
        >
            {/* Drag handle — 3 lines at edge */}
            <Box
                {...attributes}
                {...listeners}
                className="flex items-center cursor-grab active:cursor-grabbing pr-1 text-slate-400 hover:text-slate-600"
            >
                <DragIndicatorIcon fontSize="small" />
            </Box>
            <Typography className="select-none font-medium flex-1" variant="body2">
                {moduleDoc?.title ?? "Unknown Module"}
            </Typography>
            <Box className="flex flex-row items-center">
                <Typography className="select-none font-medium" variant="body2">
                    {syllabusTitle}
                </Typography>
                <Box width="0.3rem" />
                <WorkTimeChip totalHours={totalHours} />
            </Box>
        </Paper>
    );
}

// Week-panel draggable variant (unchanged behaviour)
function DraggableModuleItem({ moduleId, dayId, ...props }: ModuleItemProps) {
    const theme = useTheme();
    const state = useCurriculumState();
    const { syllabusNames } = useSyllabusNames();
    const moduleDoc = useModule(moduleId);
    const syllabusId = moduleDoc?.syllabusId;
    const color = useMemo(
        () =>
            syllabusId
                ? hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2)
                : undefined,
        [syllabusId, theme.palette.primary.main],
    );
    const syllabusTitle = useMemo(
        () => (syllabusId ? syllabusNames[syllabusId] : "סילבוס"),
        [syllabusId, syllabusNames],
    );
    const totalHours = useMemo(
        () =>
            moduleDoc
                ? calculateMinimumRequiredTimeForModule(moduleDoc, state) / 60
                : 0,
        [moduleDoc, state],
    );

    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: `module-${moduleId}`,
            data: {
                type: "MODULE",
                moduleId,
                dayId,
            } as DndDragEventActiveData,
        });

    const style = {
        ...props.style,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : "transform 200ms ease",
    };

    return (
        <Paper
            {...props}
            elevation={isDragging ? 4 : 0}
            ref={setNodeRef}
            style={style}
            sx={{ ...props.sx, backgroundColor: color }}
            {...attributes}
            {...listeners}
            className={`flex flex-row justify-between items-center
                p-2 border border-solid border-slate-200 cursor-grab
                hover:border-blue-400 hover:bg-blue-50 transition-all
                active:cursor-grabbing touch-none
                ${props.className ?? ""}
                ${isDragging ? "opacity-0 pointer-events-none" : "opacity-100"}
            `}
        >
            <Typography className="select-none font-medium" variant="body2">
                {moduleDoc?.title ?? "Unknown Module"}
            </Typography>
            <Box className="flex flex-row items-center">
                <Typography className="select-none font-medium" variant="body2">
                    {syllabusTitle}
                </Typography>
                <Box width="0.3rem" />
                <WorkTimeChip totalHours={totalHours} />
            </Box>
        </Paper>
    );
}

export function ModuleItem({ moduleId, dayId, syllabusId, ...props }: ModuleItemProps) {
    if (syllabusId && !dayId) {
        return (
            <SortableModuleItem
                {...props}
                moduleId={moduleId}
                syllabusId={syllabusId}
            />
        );
    }
    return <DraggableModuleItem {...props} dayId={dayId} moduleId={moduleId} />;
}
