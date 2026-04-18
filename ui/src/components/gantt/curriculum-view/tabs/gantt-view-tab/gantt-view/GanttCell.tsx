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
    spanVariant = 'none',
    isOpaque = false
}) =>
{
    const theme = useTheme();

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: payloadData
    });

    const getSpanBorderRadius = () =>
    {
        switch (spanVariant)
        {
            case 'start': return '4px 0 0 4px';
            case 'end': return '0 4px 4px 0';
            case 'middle': return '0';
            case 'single': return '4px';
            default: return '4px';
        }
    };

    return (
        <TableCell
            ref={ setNodeRef }
            align="center"
            sx={ {
                borderLeft: `1px solid ${theme.palette.divider}`,
                p: spanVariant !== 'none' ? 0.5 : 0.5,
                width: 80,
                minWidth: 80,
                maxWidth: 80,
                boxSizing: 'border-box',
                backgroundColor: isOver ? theme.palette.action.hover : 'inherit',
                transition: 'background-color 0.2s',
            } }
        >
            { hasBlock && blockId && blockPayload ? (
                <GanttBlock id={ blockId } payload={ blockPayload } isOpaque={ isOpaque } />
            ) : spanVariant !== 'none' ? (
                <Box
                    sx={ {
                        width: '100%',
                        height: '24px',
                        backgroundColor: theme.palette.primary.main,
                        opacity: 0.3,
                        borderRadius: getSpanBorderRadius(),
                    } }
                />
            ) : null }
        </TableCell>
    );
};