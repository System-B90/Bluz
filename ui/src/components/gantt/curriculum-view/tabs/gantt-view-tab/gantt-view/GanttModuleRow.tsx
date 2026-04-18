import { useCurriculumState } from '@/components/gantt/state/provider';
import { Box, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useGanttContext } from './context';
import { GanttBlock } from './GanttBlock';
import { GanttCell } from './GanttCell';
import { GanttEventRow } from './GanttEventRow';
import { GanttModuleRowProps, SpanVariant } from './types';

export const GanttModuleRow: React.FC<GanttModuleRowProps> = ({ moduleId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { timelineWeeks, linearDays, moduleMappings, eventMappings } = useGanttContext();
    const [ isExpanded, setIsExpanded ] = useState(false);

    const module = state.modules[ moduleId ];
    if (!module) return null;

    const hasEvents = module.events && module.events.length > 0;
    const mappedDays = moduleMappings[ moduleId ] || [];
    const isUnmapped = mappedDays.length === 0 && !hasEvents;

    // Calculate span based on events (if present) or module mappings
    const spanIndices = useMemo(() =>
    {
        let dayIds: string[] = [];
        if (hasEvents)
        {
            dayIds = module.events.map(eId => eventMappings[ eId ]).filter(Boolean);
        } else
        {
            dayIds = mappedDays;
        }

        const indices = dayIds.map(id => linearDays.indexOf(id)).filter(i => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [ hasEvents, module.events, eventMappings, mappedDays, linearDays ]);

    return (
        <React.Fragment>
            <TableRow hover>
                <TableCell
                    sx={ {
                        pl: 4,
                        width: 250,
                        minWidth: 250,
                        maxWidth: 250,
                        boxSizing: 'border-box',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        backgroundColor: theme.palette.background.paper,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        display: 'flex',
                        alignItems: 'center',
                        height: '100%',
                    } }
                >
                    { hasEvents && (
                        <Box
                            component="span"
                            onClick={ () => setIsExpanded(!isExpanded) }
                            sx={ { fontSize: '0.8rem', width: 20, cursor: 'pointer', display: 'inline-block' } }
                        >
                            { isExpanded ? '▼' : '▶' }
                        </Box>
                    ) }
                    { !hasEvents && <Box sx={ { width: 20, display: 'inline-block' } } /> }

                    <Box sx={ { flexGrow: 1, overflow: 'hidden' } }>
                        { isUnmapped ? (
                            <GanttBlock
                                id={ `drag-module-unmapped-${moduleId}` }
                                payload={ { type: 'module-map', moduleId } }
                                title={ module.title }
                            />
                        ) : (
                            <Typography variant="body2" noWrap>{ module.title }</Typography>
                        ) }
                    </Box>
                </TableCell>

                { timelineWeeks.map(week =>
                    week.days.map(dayId =>
                    {
                        const dayIndex = linearDays.indexOf(dayId);

                        let spanVariant: SpanVariant = 'none';
                        if (spanIndices && dayIndex >= spanIndices.min && dayIndex <= spanIndices.max)
                        {
                            if (spanIndices.min === spanIndices.max) spanVariant = 'single';
                            else if (dayIndex === spanIndices.min) spanVariant = 'start';
                            else if (dayIndex === spanIndices.max) spanVariant = 'end';
                            else spanVariant = 'middle';
                        }

                        const hasMappingBlock = mappedDays.includes(dayId);

                        return (
                            <GanttCell
                                key={ `${dayId}-${moduleId}` }
                                dayId={ dayId }
                                dropId={ `drop-module-${moduleId}-${dayId}` }
                                payloadData={ { targetType: 'module', moduleId, dayId } }
                                hasBlock={ hasMappingBlock && !hasEvents } // Don't show solid block if we are spanning events
                                blockId={ `drag-module-move-${moduleId}-${dayId}` }
                                blockPayload={ { type: 'module-move', moduleId, sourceDayId: dayId } }
                                spanVariant={ hasMappingBlock ? 'none' : spanVariant }
                                isOpaque={ true }
                            />
                        );
                    })
                ) }
            </TableRow>

            { isExpanded && hasEvents && module.events.map(eventId => (
                <GanttEventRow key={ eventId } eventId={ eventId } moduleId={ moduleId } />
            )) }
        </React.Fragment>
    );
};