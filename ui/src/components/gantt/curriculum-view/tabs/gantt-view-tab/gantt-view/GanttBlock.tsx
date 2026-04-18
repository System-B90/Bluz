import { useDraggable } from '@dnd-kit/core';
import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';

import { GanttBlockProps } from './types';

export const GanttBlock: React.FC<GanttBlockProps> = ({ id, payload, title, isOpaque }) =>
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

    return (
        <Box
            ref={ setNodeRef }
            { ...listeners }
            { ...attributes }
            sx={ {
                width: '100%',
                height: '24px',
                backgroundColor: theme.palette.primary.main,
                borderRadius: 1,
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.4 : (isOpaque ? 0.5 : 1),
                boxShadow: isDragging ? theme.shadows[ 4 ] : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                px: 1,
                ...style
            } }
        >
            { title ? <Typography sx={ { color: 'primary.contrastText', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } } variant="caption">
                { title }
            </Typography> : null }
        </Box>
    );
};
