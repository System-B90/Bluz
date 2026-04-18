import { useDraggable } from '@dnd-kit/core';
import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';
import { GanttBlockProps } from './types';

export const GanttBlock: React.FC<GanttBlockProps> = ({ id, payload, title, isOpaque, spanLength = 1 }) =>
{
    const theme = useTheme();

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        data: payload
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 9999,
    } : undefined;

    // Accurately stretch the block across N cells of exactly 80px width
    const blockWidth = spanLength > 1 ? `calc(${spanLength * 80}px - 8px)` : 'calc(100% - 8px)';

    return (
        <Box
            ref={ setNodeRef }
            { ...listeners }
            { ...attributes }
            sx={ {
                position: 'absolute',
                top: '5px',
                bottom: '5px',
                left: '4px',
                width: blockWidth,
                height: '24px',
                backgroundColor: theme.palette.primary.main,
                borderRadius: '4px',
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.4 : (isOpaque ? 0.5 : 1),
                boxShadow: isDragging ? theme.shadows[ 4 ] : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                px: 1,
                zIndex: isDragging ? 9999 : 10,
                ...style
            } }
        >
            { title && (
                <Typography variant="caption" sx={ { color: 'primary.contrastText', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }>
                    { title }
                </Typography>
            ) }
        </Box>
    );
};