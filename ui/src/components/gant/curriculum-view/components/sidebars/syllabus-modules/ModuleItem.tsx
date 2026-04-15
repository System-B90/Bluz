/**
 * Name: ModuleItem.tsx
 * Purpose: Draggable module item with placeholder logic for DragOverlay support.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { useModule } from "@/components/gant/state/hooks";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Paper, PaperProps, Typography } from "@mui/material";

export interface ModuleItemProps extends PaperProps
{
    moduleId: ModuleId;
}

export function ModuleItem({ moduleId, ...props }: ModuleItemProps)
{
    const moduleDoc = useModule(moduleId);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `module-${moduleId}`,
        data: { type: "MODULE", moduleId },
    });

    const style = {
        ...props.style,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : "transform 200ms ease",
    };

    return (
        <Paper
            { ...props }
            ref={ setNodeRef }
            style={ style }
            elevation={ isDragging ? 4 : 0 }
            { ...attributes }
            { ...listeners }
            className={ `
                p-2 border border-solid border-slate-200 cursor-grab 
                hover:border-blue-400 hover:bg-blue-50 transition-all
                active:cursor-grabbing touch-none
                ${props.className ?? ""}
                
                /* When using DragOverlay, the original item stays in the list.
                   We hide it visually so only the 'portal' version is seen.
                   'invisible' or 'opacity-0' preserves the height so the list doesn't jump.
                */
                ${isDragging ? "opacity-0 pointer-events-none" : "opacity-100"}
            `}
        >
            <Typography variant="body2" className="select-none font-medium text-slate-700">
                { moduleDoc?.title ?? "Unknown Module" }
            </Typography>
        </Paper>
    );
}
