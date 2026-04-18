import { useCurriculumState } from '@/components/gantt/state/provider';
import { useDroppable } from '@dnd-kit/core';
import { alpha, Box, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { useMemo } from 'react';
import { useGanttContext } from './context';
import { GanttBlock } from './GanttBlock';
import { GanttCell } from './GanttCell';
import { GanttEventRowProps } from './types';

export const GanttEventRow: React.FC<GanttEventRowProps> = ({ eventId, moduleId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { timelineWeeks, linearDays, moduleMappings, eventMappings } = useGanttContext();

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable({
        id: `drop-remove-event-${eventId}`,
        data: { targetType: 'remove', moduleId, eventId }
    });

    const event = state.events[ eventId ];
    if (!event) return null;

    const currentDayId = eventMappings[ eventId ];
    const isEventUnmapped = !currentDayId;

    // Calculate if the parent module is mapped and where its span starts
    const { isModuleMapped, moduleStartDayId } = useMemo(() =>
    {
        const mappedDays = moduleMappings[ moduleId ] || [];
        const dayIds = new Set<string>(mappedDays);

        const module = state.modules[ moduleId ];
        if (module && module.events)
        {
            module.events.forEach(eId =>
            {
                if (eventMappings[ eId ]) dayIds.add(eventMappings[ eId ]);
            });
        }

        const indices = Array.from(dayIds).map(id => linearDays.indexOf(id)).filter(i => i !== -1);
        const mapped = indices.length > 0;
        const startId = mapped ? linearDays[ Math.min(...indices) ] : null;

        return { isModuleMapped: mapped, moduleStartDayId: startId };
    }, [ moduleId, state.modules, moduleMappings, eventMappings, linearDays ]);

    return (
        <TableRow hover>
            <TableCell
                ref={ setRemoveNodeRef }
                sx={ {
                    pl: 8,
                    width: 250,
                    minWidth: 250,
                    maxWidth: 250,
                    boxSizing: 'border-box',
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    backgroundColor: isRemoveOver ? alpha(theme.palette.error.main, 0.08) : theme.palette.background.paper,
                    borderRight: `1px solid ${theme.palette.divider}`,
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%'
                } }
            >
                <Typography variant="caption" color="text.secondary" noWrap sx={ { display: 'block' } }>↳ { event.title }</Typography>

                {/* Render fully unmapped events in the sticky column */ }
                { isEventUnmapped && !isModuleMapped && (
                    <Box sx={ { flexGrow: 1, position: 'relative', ml: 1, height: '24px' } }>
                        <GanttBlock
                            id={ `drag-event-unmapped-${eventId}` }
                            payload={ { type: 'event-map', moduleId, eventId } }
                            title={ event.title }
                            isAbsolute={ false }
                        />
                    </Box>
                ) }
            </TableCell>

            { timelineWeeks.map(week =>
                week.days.map(dayId =>
                {
                    const isExplicitlyMappedHere = currentDayId === dayId;
                    const isWaitingInModuleStartColumn = isEventUnmapped && isModuleMapped && moduleStartDayId === dayId;
                    const hasBlock = isExplicitlyMappedHere || isWaitingInModuleStartColumn;

                    const blockPayload = isExplicitlyMappedHere
                        ? { type: 'event-move', moduleId, eventId, sourceDayId: dayId }
                        : { type: 'event-map', moduleId, eventId };

                    const blockId = isExplicitlyMappedHere
                        ? `drag-event-${eventId}-${dayId}`
                        : `drag-event-staged-${eventId}`;

                    return (
                        <GanttCell
                            key={ `${dayId}-${eventId}` }
                            dayId={ dayId }
                            dropId={ `drop-event-${eventId}-${dayId}` }
                            payloadData={ { targetType: 'event', eventId, dayId } }
                            hasBlock={ hasBlock }
                            blockId={ blockId }
                            blockPayload={ blockPayload }
                            blockTitle={ event.title }
                            isAbsoluteBlock={ true }
                            // Add opacity cue to unmapped blocks resting under the module start block
                            isOpaque={ isWaitingInModuleStartColumn }
                        />
                    );
                })
            ) }
        </TableRow>
    );
};