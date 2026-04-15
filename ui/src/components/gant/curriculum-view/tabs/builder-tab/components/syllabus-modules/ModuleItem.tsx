/**
 * Name: ModuleItem.tsx
 * Purpose: Draggable module item with placeholder logic for DragOverlay support.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { hashSyllabusToColor } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import { WorkTimeChip } from "@/components/gant/curriculum-view/tabs/weeks-tab/WeekPanel";
import { useModule } from "@/components/gant/state/hooks";
import { useCurriculumState } from "@/components/gant/state/provider";
import { useSyllabusNames } from "@/components/gant/state/providers/SyllabusNamesProvider";
import { calculateMinimumRequiredTimeForModule } from "@/components/gant/utils";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Box, Paper, PaperProps, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";

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
    const color = useMemo(() => hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2), [ syllabusId, theme.palette.primary.main ]);
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
            ref={ setNodeRef }
            style={ style }
            elevation={ isDragging ? 4 : 0 }
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
            <Typography variant="body2" className="select-none font-medium text-slate-700">
                { moduleDoc?.title ?? "Unknown Module" }
            </Typography>
            <Box className="flex flex-row items-center">
                <Typography variant="body2" className="select-none font-medium text-slate-700">
                    { syllabusTitle }
                </Typography>
                <Box width='0.3rem' />
                <WorkTimeChip totalHours={ totalHours } />
            </Box>
        </Paper>
    );
}
