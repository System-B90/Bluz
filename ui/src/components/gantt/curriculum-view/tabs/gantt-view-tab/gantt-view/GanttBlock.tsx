import { useDraggable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { memo } from "react";

import { GanttBlockProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

const GanttBlockComponent: React.FC<GanttBlockProps> = ({
    id,
    payload,
    title,
    timeLabel,
    isOpaque,
    spanLength = 1,
    isAbsolute = true,
    elementId,
    violations = [],
    blockLeftPercent,
    blockWidthPercent,
    isSpillover = false,
}) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const { openModuleDialog, openEventDialog } = useCurriculumProviderActions();

    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id,
            data: payload,
        });

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (!payload || !payload.moduleId) return;

        e.stopPropagation();
        e.preventDefault();
        const moduleObj = state.modules[payload.moduleId];
        if (!moduleObj?.syllabusId) return;

        if (payload.eventId) {
            openEventDialog(moduleObj.syllabusId, payload.moduleId, payload.eventId);
        } else {
            openModuleDialog(moduleObj.syllabusId, payload.moduleId);
        }
    };

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)${isDragging ? " rotate(2.5deg) scale(1.02)" : ""}`,
            zIndex: 9999,
        }
        : undefined;

    const blockWidth =
        blockWidthPercent !== undefined
            ? `calc(${blockWidthPercent}% - 4px)`
            : spanLength > 1
                ? `calc(${spanLength * 100}% - 8px)`
                : isAbsolute
                    ? "calc(100% - 8px)"
                    : "100%";

    const isViolated = violations.length > 0;

    // Multi-day overflow blocks fade out toward the spilled days (#105).
    const spilloverBackground =
        isSpillover && !isOpaque
            ? `linear-gradient(to left, ${theme.palette.primary.main} 55%, ${alpha(
                theme.palette.primary.main,
                0.45,
            )} 100%)`
            : undefined;

    const block = (
        <Box
            id={elementId}
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onDoubleClick={handleDoubleClick}
            sx={{
                position: isAbsolute ? "absolute" : "relative",
                top: isAbsolute ? "5px" : "auto",
                bottom: isAbsolute ? "5px" : "auto",
                left: isAbsolute
                    ? blockLeftPercent !== undefined
                        ? `calc(${blockLeftPercent}% + 2px)`
                        : "4px"
                    : "auto",
                width: blockWidth,
                height: "24px",
                backgroundColor: isOpaque
                    ? "transparent"
                    : theme.palette.primary.main,
                backgroundImage: spilloverBackground,
                borderRadius: "4px",
                border: isViolated
                    ? `2px solid ${theme.palette.error.main}`
                    : isOpaque
                        ? `1px solid ${theme.palette.primary.main}`
                        : "none",
                cursor: isDragging ? "grabbing" : "grab",
                opacity: isDragging ? 0.8 : 1,
                boxShadow: isDragging
                    ? "0 10px 25px rgba(0, 0, 0, 0.2)"
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: timeLabel ? "space-between" : "center",
                gap: 0.5,
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
                        color: isOpaque
                            ? "primary.main"
                            : "primary.contrastText",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                    variant="caption"
                >
                    {title}
                </Typography>
            ) : null}
            {timeLabel ? (
                <Typography
                    sx={{
                        color: isOpaque
                            ? "primary.main"
                            : "primary.contrastText",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        opacity: 0.9,
                    }}
                    variant="caption"
                >
                    {timeLabel}
                </Typography>
            ) : null}
        </Box>
    );

    const spilloverNote = isSpillover ? "גולש על פני מספר ימים" : "";
    const tooltipContent = [title ?? "", spilloverNote, ...violations]
        .filter(Boolean)
        .join("\n")
        .trim();

    return tooltipContent ? (
        <Tooltip arrow placement="top" title={tooltipContent}>
            {block}
        </Tooltip>
    ) : (
        block
    );
};

export const GanttBlock = memo(GanttBlockComponent);
