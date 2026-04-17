/**
 * Name: ModuleItem.tsx
 * Purpose: Draggable module item with placeholder logic for DragOverlay support.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Box, Paper, PaperProps, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";

import { ModuleId } from "@/api-shared/types/gantt/curriculum";
import { hashSyllabusToColor } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/utils";
import { WorkTimeChip } from "@/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useModule } from "@/components/gantt/state/hooks/UseModule";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { useSyllabusNames } from "@/components/gantt/state/providers/SyllabusNamesProvider";
import { calculateMinimumRequiredTimeForModule } from "@/components/gantt/utils";

export interface ModuleItemProps extends PaperProps
{
    moduleId: ModuleId;
    weekIndex?: number;
    dayIndex?: number;
}

export function ModuleItem({ moduleId, weekIndex, dayIndex, ...props }: ModuleItemProps)
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { syllabusNames } = useSyllabusNames();
    const moduleDoc = useModule(moduleId);
    const syllabusId = useMemo(() => state.moduleToSyllabusLookup[ moduleId ], [ moduleId, state.moduleToSyllabusLookup ]);
    const color = useMemo(() => syllabusId ? hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2) : undefined, [ syllabusId, theme.palette.primary.main ]);
    const syllabusTitle = useMemo(() => syllabusNames[ syllabusId ], [ syllabusId, syllabusNames ]);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `module-${moduleId}`,
        data: { type: "MODULE", moduleId, weekIndex, dayIndex },
    });

    const style = {
        ...props.style,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : "transform 200ms ease",
    };

    const totalHours = useMemo(() => moduleDoc ? calculateMinimumRequiredTimeForModule(moduleDoc, state) / 60 : 0, [ moduleDoc, state ]);

    return (
        <Paper
            { ...props }
            elevation={ isDragging ? 4 : 0 }
            ref={ setNodeRef }
            style={ style }
            sx={ { ...props.sx, backgroundColor: color } }
            { ...attributes }
            { ...listeners }
            className={ `flex flex-row justify-between items-center
                p-2 border border-solid border-slate-200 cursor-grab 
                hover:border-blue-400 hover:bg-blue-50 transition-all
                active:cursor-grabbing touch-none
                ${props.className ?? ""}
                ${isDragging ? "opacity-0 pointer-events-none" : "opacity-100"}
            `}
        >
            <Typography className="select-none font-medium" variant="body2">
                { moduleDoc?.title ?? "Unknown Module" }
            </Typography>
            <Box className="flex flex-row items-center">
                <Typography className="select-none font-medium" variant="body2">
                    { syllabusTitle }
                </Typography>
                <Box width='0.3rem' />
                <WorkTimeChip totalHours={ totalHours } />
            </Box>
        </Paper>
    );
}
