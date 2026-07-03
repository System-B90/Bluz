import { useDroppable } from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import React, { memo, useMemo } from "react";

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
    spanLength = 1,
    isOpaque = false,
    isAbsoluteBlock = true,
    elementId,
    violations,
    blockLeftPx,
    blockWidthPx,
    isSpillover,
}) => {
    const theme = useTheme();
    const { dayCellWidth } = useGanttContext();

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: payloadData,
    });

    // Precompute so emotion doesn't re-serialize a fresh object on every
    // drag-driven re-render of the (many) day cells (#88).
    const cellSx = useMemo(
        () => ({
            borderLeft: `1px solid ${theme.vars.palette.divider}`,
            p: 0,
            width: dayCellWidth,
            minWidth: dayCellWidth,
            boxSizing: "border-box" as const,
            backgroundColor: isOver
                ? theme.vars.palette.action.hover
                : "inherit",
            transition: "background-color 0.2s",
        }),
        [theme, dayCellWidth, isOver],
    );

    return (
        <TableCell align="center" ref={setNodeRef} sx={cellSx}>
            <Box sx={CELL_INNER_SX}>
                {hasBlock && blockId && blockPayload ? (
                    <GanttBlock
                        blockLeftPx={blockLeftPx}
                        blockWidthPx={blockWidthPx}
                        elementId={elementId}
                        id={blockId}
                        isAbsolute={isAbsoluteBlock}
                        isOpaque={isOpaque}
                        isSpillover={isSpillover}
                        payload={blockPayload}
                        spanLength={spanLength}
                        title={blockTitle}
                        violations={violations}
                    />
                ) : null}
            </Box>
        </TableCell>
    );
};

export const GanttCell = memo(GanttCellComponent);
