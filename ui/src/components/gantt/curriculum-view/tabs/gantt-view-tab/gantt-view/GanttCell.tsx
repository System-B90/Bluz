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
                p: 0, // Removed padding to allow the span background to stretch edge-to-edge
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
                {/* Continuous Background Span */ }
                { spanVariant !== 'none' && (
                    <Box
                        sx={ {
                            position: 'absolute',
                            top: '5px',
                            bottom: '5px',
                            // Pull negative margins on middle pieces to completely hide the 1px cell border gap
                            left: spanVariant === 'middle' || spanVariant === 'end' ? '-1px' : '4px',
                            right: spanVariant === 'middle' || spanVariant === 'start' ? '-1px' : '4px',
                            backgroundColor: theme.palette.primary.main,
                            opacity: 0.3,
                            borderRadius: getSpanBorderRadius(),
                            zIndex: 0,
                        } }
                    />
                ) }

                {/* Draggable Interaction Block */ }
                { hasBlock && blockId && blockPayload && (
                    <Box sx={ { width: 'calc(100% - 8px)', zIndex: 1 } }>
                        <GanttBlock id={ blockId } payload={ blockPayload } isOpaque={ isOpaque } />
                    </Box>
                ) }
            </Box>
        </TableCell>
    );
};