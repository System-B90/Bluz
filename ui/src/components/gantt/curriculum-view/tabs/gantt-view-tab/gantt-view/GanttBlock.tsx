import { useDraggable } from "@dnd-kit/core";
import { Box, Tooltip, Typography, useTheme } from "@mui/material";
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
    blockLeftPx,
    blockWidthPx,
}) => {
    const theme = useTheme();

    const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
        id,
        data: payload,
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
            zIndex: 9999,
        }
        : undefined;

    const blockWidth = blockWidthPx !== undefined
        ? `${blockWidthPx}px`
        : spanLength > 1
            ? `calc(${spanLength * 80}px - 8px)`
            : isAbsolute
                ? "calc(100% - 8px)"
                : "100%";

    const blockLeft = blockLeftPx !== undefined ? `${blockLeftPx}px` : "4px";

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
                left: isAbsolute ? blockLeft : "auto",
                width: blockWidth,
                height: "24px",
                backgroundColor: theme.palette.primary.main,
                borderRadius: "4px",
                border: isViolated ? `2px solid ${theme.palette.error.main}` : "none",
                cursor: isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.4 : isOpaque ? 0.5 : 1,
                boxShadow: isDragging ? theme.shadows[4] : "none",
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
        : title ?? "";

    return tooltipContent ? (
        <Tooltip arrow placement="top" title={tooltipContent}>
            {block}
        </Tooltip>
    ) : (
        block
    );
};
