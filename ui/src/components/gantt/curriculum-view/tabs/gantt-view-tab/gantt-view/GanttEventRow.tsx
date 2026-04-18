import { useCurriculumState } from '@/components/gantt/state/provider';
import { TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useGanttContext } from './context';
import { GanttCell } from './GanttCell';
import { GanttEventRowProps } from './types';

export const GanttEventRow: React.FC<GanttEventRowProps> = ({ eventId, moduleId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { timelineWeeks, eventMappings } = useGanttContext();

    const event = state.events[ eventId ];
    if (!event) return null;

    const currentDayId = eventMappings[ eventId ];

    return (
        <TableRow hover>
            <TableCell
                sx={ {
                    pl: 8,
                    width: 250,
                    minWidth: 250,
                    maxWidth: 250,
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    backgroundColor: theme.palette.background.paper,
                    borderRight: `1px solid ${theme.palette.divider}`
                } }
            >
                <Typography variant="caption" color="text.secondary" noWrap>↳ { event.title }</Typography>
            </TableCell>

            { timelineWeeks.map(week =>
                week.days.map(dayId =>
                {
                    const isMappedHere = currentDayId === dayId;
                    return (
                        <GanttCell
                            key={ `${dayId}-${eventId}` }
                            dayId={ dayId }
                            dropId={ `drop-event-${eventId}-${dayId}` }
                            payloadData={ { targetType: 'event', eventId, dayId } }
                            hasBlock={ isMappedHere }
                            blockId={ `drag-event-${eventId}-${dayId}` }
                            blockPayload={ { type: 'event-move', moduleId, eventId, sourceDayId: dayId } }
                        />
                    );
                })
            ) }
        </TableRow>
    );
};