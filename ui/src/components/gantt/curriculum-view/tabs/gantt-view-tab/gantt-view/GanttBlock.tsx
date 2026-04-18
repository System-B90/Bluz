import { useDraggable } from '@dnd-kit/core';
import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';
import { GanttBlockProps } from './types';

export const GanttBlock: React.FC<GanttBlockProps> = ({ 
  id, 
  payload, 
  title, 
  isOpaque, 
  spanLength = 1,
  isAbsolute = true
}) => {
  const theme = useTheme();
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: payload
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 9999,
  } : undefined;

  const blockWidth = spanLength > 1 
    ? `calc(${spanLength * 80}px - 8px)` 
    : (isAbsolute ? 'calc(100% - 8px)' : '100%');

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        position: isAbsolute ? 'absolute' : 'relative',
        top: isAbsolute ? '5px' : 'auto',
        bottom: isAbsolute ? '5px' : 'auto',
        left: isAbsolute ? '4px' : 'auto',
        width: blockWidth,
        height: '24px',
        backgroundColor: theme.palette.primary.main,
        borderRadius: '4px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : (isOpaque ? 0.5 : 1),
        boxShadow: isDragging ? theme.shadows[4] : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        px: 1,
        // Default to a lower zIndex to slide under the sticky column
        zIndex: isDragging ? 9999 : 1,
        ...style
      }}
    >
      {title && (
        <Typography variant="caption" sx={{ color: 'primary.contrastText', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </Typography>
      )}
    </Box>
  );
};