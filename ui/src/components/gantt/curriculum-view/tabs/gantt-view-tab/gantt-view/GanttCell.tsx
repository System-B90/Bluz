import { useDroppable } from '@dnd-kit/core';
import { Box, TableCell, useTheme } from '@mui/material';
import React from 'react';
import { GanttBlock } from './GanttBlock';
import { GanttCellProps } from './types';

export const GanttCell: React.FC<GanttCellProps> = ({
    dayId,
    dropId,
    payloadData,
    hasBlock,
    blockId,
    blockPayload,
    spanLength = 1,
    isOpaque = false
}) =>
{
    const theme = useTheme();

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: payloadData
    });

    return (
        <TableCell
            ref={ setNodeRef }
            align="center"
            sx={ {
                borderLeft: `1px solid ${theme.palette.divider}`,
                p: 0,
                width: 80,
                minWidth: 80,
                maxWidth: 80,
                boxSizing: 'border-box',
                backgroundColor: isOver ? theme.palette.action.hover : 'inherit',
                transition: 'background-color 0.2s',
            } }
        >
            <Box
                sx={ {
                    width: '100%',
                    height: '34px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                } }
            >
                { hasBlock && blockId && blockPayload && (
                    <GanttBlock
                        id={ blockId }
                        payload={ blockPayload }
                        isOpaque={ isOpaque }
                        spanLength={ spanLength }
                    />
                ) }
            </Box>
        </TableCell>
    );
};