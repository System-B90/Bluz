import { useDroppable } from "@dnd-kit/core";
import { Box, TableCell, useTheme } from "@mui/material";
import React from "react";

import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttCellProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

export const GanttCell: React.FC<GanttCellProps> = ({
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
}) => {
    const theme = useTheme();

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: payloadData,
    });

    return (
        <TableCell
            align="center"
            ref={setNodeRef}
            sx={{
                borderLeft: `1px solid ${theme.palette.divider}`,
                p: 0,
                width: 80,
                minWidth: 80,
                maxWidth: 80,
                boxSizing: "border-box",
                backgroundColor: isOver ? theme.palette.action.hover : "inherit",
                transition: "background-color 0.2s",
            }}
        >
            <Box
                sx={{
                    width: "100%",
                    height: "34px",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {hasBlock && blockId && blockPayload ? (
                    <GanttBlock
                        elementId={elementId}
                        id={blockId}
                        isAbsolute={isAbsoluteBlock}
                        isOpaque={isOpaque}
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
