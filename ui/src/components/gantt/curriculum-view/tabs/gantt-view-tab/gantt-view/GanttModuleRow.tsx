import { useCurriculumState } from '@/components/gantt/state/provider';
import { useDroppable } from '@dnd-kit/core';
import { alpha, Box, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useGanttContext } from './context';
import { GanttBlock } from './GanttBlock';
import { GanttCell } from './GanttCell';
import { GanttEventRow } from './GanttEventRow';
import { GanttModuleRowProps } from './types';

export const GanttModuleRow: React.FC<GanttModuleRowProps> = ({ moduleId }) => {
  const theme = useTheme();
  const state = useCurriculumState();
  const { timelineWeeks, linearDays, moduleMappings, eventMappings } = useGanttContext();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable({
    id: `drop-remove-module-${moduleId}`,
    data: { targetType: 'remove', moduleId, eventId: null }
  });

  const module = state.modules[moduleId];
  if (!module) return null;

  const hasEvents = module.events && module.events.length > 0;
  const mappedDays = moduleMappings[moduleId] || [];

  const spanIndices = useMemo(() => {
    const dayIds = new Set<string>();
    
    mappedDays.forEach(d => dayIds.add(d));

    if (hasEvents) {
      module.events.forEach(eId => {
        const d = eventMappings[eId];
        if (d) dayIds.add(d);
      });
    }

    const indices = Array.from(dayIds).map(id => linearDays.indexOf(id)).filter(i => i !== -1);
    if (indices.length === 0) return null;
    return { min: Math.min(...indices), max: Math.max(...indices) };
  }, [hasEvents, module.events, eventMappings, mappedDays, linearDays]);

  const isUnmapped = spanIndices === null;
  const spanLength = spanIndices ? spanIndices.max - spanIndices.min + 1 : 1;

  return (
    <React.Fragment>
      <TableRow hover>
        <TableCell 
          ref={setRemoveNodeRef}
          sx={{ 
            pl: 4, 
            width: 250,
            minWidth: 250, 
            maxWidth: 250,
            boxSizing: 'border-box',
            position: 'sticky',
            left: 0,
            zIndex: 5,
            backgroundColor: isRemoveOver ? alpha(theme.palette.error.main, 0.08) : theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            transition: 'background-color 0.2s'
          }}
        >
          {hasEvents && (
            <Box 
              component="span" 
              onClick={() => setIsExpanded(!isExpanded)}
              sx={{ fontSize: '0.8rem', width: 20, cursor: 'pointer', display: 'inline-block' }}
            >
              {isExpanded ? '▼' : '▶'}
            </Box>
          )}
          {!hasEvents && <Box sx={{ width: 20, display: 'inline-block' }} />}
          
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            {isUnmapped ? (
              <GanttBlock 
                id={`drag-module-unmapped-${moduleId}`} 
                payload={{ type: 'module-map', moduleId }} 
                title={module.title}
                spanLength={1}
                isAbsolute={false}
              />
            ) : (
              <Typography variant="body2" sx={{ lineHeight: '24px' }} noWrap>{module.title}</Typography>
            )}
          </Box>
        </TableCell>

        {timelineWeeks.map(week =>
          week.days.map(dayId => {
            const dayIndex = linearDays.indexOf(dayId);
            const isSpanStart = spanIndices !== null && dayIndex === spanIndices.min;

            return (
              <GanttCell 
                key={`${dayId}-${moduleId}`} 
                dayId={dayId} 
                dropId={`drop-module-${moduleId}-${dayId}`}
                payloadData={{ targetType: 'module', moduleId, dayId }}
                hasBlock={isSpanStart}
                blockId={`drag-module-shift-${moduleId}-${dayId}`}
                blockPayload={{ type: 'module-shift', moduleId, sourceDayId: dayId }}
                blockTitle={module.title}
                spanLength={spanLength}
                isOpaque={hasEvents && isExpanded}
                isAbsoluteBlock={true}
              />
            );
          })
        )}
      </TableRow>

      {isExpanded && hasEvents && module.events.map(eventId => (
        <GanttEventRow key={eventId} eventId={eventId} moduleId={moduleId} />
      ))}
    </React.Fragment>
  );
};