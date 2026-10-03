/**
 * Name: GanttUnscheduledChip.tsx
 * Purpose: The drag handle of a module that is not on the timeline yet. It
 *   sits beside the module's name (which stays visible) and looks nothing
 *   like a scheduled bar: dashed outline, "לא משובץ" (#817).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import { useDraggable } from "@dnd-kit/core";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

const UNSCHEDULED_LABEL = "לא משובץ";
export const UNSCHEDULED_HINT = "לא משובץ — גרור לציר";

type GanttUnscheduledChipProps = {
    moduleId: string;
    moduleTitle: string;
    disableDrag?: boolean;
    violations?: Array<string>;
    /** Enter / double-click: opens the module, like a timeline bar. */
    onOpen: () => void;
};

export const GanttUnscheduledChip: React.FC<GanttUnscheduledChipProps> = ({
    moduleId,
    moduleTitle,
    disableDrag = false,
    violations = [],
    onOpen,
}) =>
{
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `drag-module-unmapped-${moduleId}`,
        disabled: disableDrag,
        data: { type: "module-map", moduleId },
    });

    const hint = disableDrag ? UNSCHEDULED_LABEL : UNSCHEDULED_HINT;
    const tooltip = [ moduleTitle, hint, ...violations ].filter(Boolean).join("\n");

    return (
        <Tooltip
            arrow
            placement="top"
            slotProps={ { tooltip: { sx: { whiteSpace: "pre-line" } } } }
            title={ tooltip }
        >
            <Box
                // Constraint lines and e2e locate the module by this id.
                id={ `block-module-${moduleId}` }
                ref={ setNodeRef }
                { ...attributes }
                { ...listeners }
                aria-label={ `${moduleTitle}: ${hint}` }
                data-gantt-unscheduled
                onDoubleClick={ (e) =>
                {
                    e.stopPropagation();
                    onOpen();
                } }
                onKeyDown={ (e) =>
                {
                    if (e.key === "Enter")
                    {
                        e.preventDefault();
                        onOpen();
                        return;
                    }
                    listeners?.onKeyDown?.(e);
                } }
                role="button"
                sx={ (theme) => ({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.25,
                    flexShrink: 0,
                    height: 22,
                    paddingInline: 0.75,
                    marginInlineStart: 0.5,
                    borderRadius: "11px",
                    border: `1px dashed ${violations.length > 0
                        ? theme.vars.palette.error.main
                        : theme.vars.palette.text.secondary}`,
                    color: "text.secondary",
                    backgroundColor: "transparent",
                    cursor: disableDrag ? "default" : isDragging ? "grabbing" : "grab",
                    touchAction: "none",
                    position: "relative",
                    zIndex: isDragging ? 9999 : 1,
                    transform: transform
                        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
                        : undefined,
                    "&:focus-visible": {
                        outline: `2px solid ${theme.vars.palette.primary.main}`,
                        outlineOffset: 1,
                    },
                }) }
                tabIndex={ 0 }
            >
                <DragIndicatorIcon aria-hidden sx={ { fontSize: 14 } } />
                <Typography sx={ { whiteSpace: "nowrap" } } variant="caption">
                    { UNSCHEDULED_LABEL }
                </Typography>
            </Box>
        </Tooltip>
    );
};
