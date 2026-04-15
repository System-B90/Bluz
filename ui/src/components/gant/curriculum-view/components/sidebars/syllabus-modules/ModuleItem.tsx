import { ModuleId } from "@/api-shared/types/gant/curriculum";
import { useModule } from "@/components/gant/state/hooks";
import { useDraggable } from "@dnd-kit/core";
import { Paper, PaperProps, Typography } from "@mui/material";

export interface ModuleItemProps extends PaperProps
{
    moduleId: ModuleId;
}

export function ModuleItem({ moduleId, ...props }: ModuleItemProps)
{
    const module = useModule(moduleId);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `module-${moduleId}`,
        data: { type: 'MODULE', moduleId }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <Paper
            ref={ setNodeRef }
            style={ style }
            elevation={ isDragging ? 4 : 0 }
            { ...attributes }
            { ...listeners }
            { ...props }
            className={ `
                p-2 border border-solid border-slate-200 cursor-grab 
                hover:border-blue-400 hover:bg-blue-50 transition-colors
                active:cursor-grabbing z-10
                ${isDragging ? 'opacity-50' : 'opacity-100'}
            `}
        >
            <Typography variant="body2" className="select-none font-medium text-slate-700">
                { module?.title ?? 'Unknown Module' }
            </Typography>
        </Paper>
    );
}
