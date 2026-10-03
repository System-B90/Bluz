import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";
import React, { memo, useCallback, useMemo, useState } from "react";

import { useGanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCellProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

const CELL_INNER_SX = {
    width: "100%",
    height: "34px",
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const GanttCellComponent: React.FC<GanttCellProps> = ({
    dayId: _dayId,
    dropId,
    payloadData,
    hasBlock,
    blockId,
    blockPayload,
    blockTitle,
    blockMinutes,
    blockTimeLabel,
    spanLength = 1,
    isOpaque = false,
    isAbsoluteBlock = true,
    elementId,
    violations,
    blockLeftPercent,
    blockWidthPercent,
    isSpillover,
    isRecurrence,
    isSkipped,
    disableDrag,
    onDoubleClick,
}) => {
    const theme = useTheme();
    const { dayCellWidth, getDropWarning } = useGanttContext();

    const { isOver, active, setNodeRef } = useDroppable({
        id: dropId,
        data: payloadData,
    });
    const [ cellNode, setCellNode ] = useState<HTMLElement | null>(null);
    const setRefs = useCallback((node: HTMLElement | null) => {
        setNodeRef(node);
        setCellNode(node);
    }, [ setNodeRef ]);

    // Only the hovered cell asks, so the check costs one call per move (#811).
    const dropWarning = isOver
        ? getDropWarning(active?.data.current, payloadData as Record<string, unknown>)
        : null;

    // Precompute so emotion doesn't re-serialize a fresh object on every
    // drag-driven re-render of the (many) day cells (#88).
    const cellSx = useMemo(
        () => ({
            borderLeft: `1px solid ${theme.vars.palette.divider}`,
            p: 0,
            width: dayCellWidth,
            minWidth: dayCellWidth,
            boxSizing: "border-box" as const,
            // A drop target you can actually see (#811): tinted and outlined,
            // red when the drop would break a rule.
            backgroundColor: isOver
                ? alpha(dropWarning ? theme.palette.error.main : theme.palette.primary.main, 0.16)
                : "inherit",
            boxShadow: isOver
                ? `inset 0 0 0 2px ${dropWarning ? theme.vars.palette.error.main : theme.vars.palette.primary.main}`
                : undefined,
            // Only the hovered cell animates: ~600 day cells each carrying a
            // transition re-animated on every drag-driven render (#831).
            transition: isOver ? "background-color 0.2s" : undefined,
        }),
        [theme, dayCellWidth, isOver, dropWarning],
    );

    return (
        <TableCell
            align="center"
            data-drop-warning={dropWarning ?? undefined}
            ref={setRefs}
            sx={cellSx}
        >
            <Box sx={CELL_INNER_SX}>
                {hasBlock && blockId && blockPayload ? (
                    <GanttBlock
                        blockLeftPercent={blockLeftPercent}
                        blockWidthPercent={blockWidthPercent}
                        disableDrag={disableDrag}
                        elementId={elementId}
                        id={blockId}
                        isAbsolute={isAbsoluteBlock}
                        isOpaque={isOpaque}
                        isRecurrence={isRecurrence}
                        isSkipped={isSkipped}
                        isSpillover={isSpillover}
                        minutes={blockMinutes}
                        onDoubleClick={onDoubleClick}
                        payload={blockPayload}
                        spanLength={spanLength}
                        timeLabel={blockTimeLabel}
                        title={blockTitle}
                        violations={violations}
                    />
                ) : null}
            </Box>
            {dropWarning && cellNode ? (
                <Popper
                    anchorEl={cellNode}
                    open
                    placement="top"
                    sx={{ zIndex: (t) => t.zIndex.tooltip, pointerEvents: "none" }}
                >
                    <Paper
                        role="status"
                        sx={{
                            px: 1,
                            py: 0.5,
                            mb: 0.5,
                            backgroundColor: "error.main",
                            color: "error.contrastText",
                        }}
                    >
                        <Typography variant="caption">{dropWarning}</Typography>
                    </Paper>
                </Popper>
            ) : null}
        </TableCell>
    );
};

export const GanttCell = memo(GanttCellComponent);
