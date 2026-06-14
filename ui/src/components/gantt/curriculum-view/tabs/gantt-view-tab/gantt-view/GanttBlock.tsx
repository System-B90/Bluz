import { useDraggable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useTheme from "@mui/material/useTheme";
import React from "react";

import { GanttBlockProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

export const GanttBlock: React.FC<GanttBlockProps> = ({
    id,
    payload,
    title,
    isOpaque,
    spanLength = 1,
    isAbsolute = true,
    elementId,
    violations = [],
}) => {
    const theme = useTheme();

    const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
        id,
        data: payload,
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)${isDragging ? " rotate(2.5deg) scale(1.02)" : ""}`,
            zIndex: 9999,
        }
        : undefined;

    const blockWidth =
    spanLength > 1
        ? `calc(${spanLength * 100}% - 8px)`
        : isAbsolute
            ? "calc(100% - 8px)"
            : "100%";

    const isViolated = violations.length > 0;

    const block = (
        <Box
            id={elementId}
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            sx={{
                position: isAbsolute ? "absolute" : "relative",
                top: isAbsolute ? "5px" : "auto",
                bottom: isAbsolute ? "5px" : "auto",
                left: isAbsolute ? "4px" : "auto",
                width: blockWidth,
                height: "24px",
                backgroundColor: theme.palette.primary.main,
                borderRadius: "4px",
                border: isViolated ? `2px solid ${theme.palette.error.main}` : "none",
                cursor: isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.8 : isOpaque ? 0.5 : 1,
                boxShadow: isDragging ? "0 10px 25px rgba(0, 0, 0, 0.2)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                px: 1,
                boxSizing: "border-box",
                zIndex: isDragging ? 9999 : 1,
                ...style,
            }}
        >
            {title ? (
                <Typography
                    sx={{
                        color: "primary.contrastText",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    variant="caption"
                >
                    {title}
                </Typography>
            ) : null}
        </Box>
    );

    const tooltipContent = isViolated
        ? `${title ?? ""}\n${violations.join("\n")}`.trim()
        : (title ?? "");

    return tooltipContent ? (
        <Tooltip arrow placement="top" title={tooltipContent}>
            {block}
        </Tooltip>
    ) : (
        block
    );
};
