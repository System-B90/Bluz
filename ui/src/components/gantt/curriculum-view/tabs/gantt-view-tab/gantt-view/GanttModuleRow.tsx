import { useDroppable } from '@dnd-kit/core';
import { alpha, Box, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { useMemo, useState } from 'react';

import { useGanttContext } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context';
import { GanttBlock } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock';
import { GanttCell } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttCell';
import { GanttEventRow } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttEventRow';
import { GanttModuleRowProps } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types';
import { useModule } from '@/components/gantt/state/hooks/UseModule';

export const GanttModuleRow: React.FC<GanttModuleRowProps> = ({ moduleId }) =>
{
    const theme = useTheme();
    const ganttModule = useModule(moduleId);
    const { timelineWeeks, linearDays, moduleMappings, eventMappings, violations } = useGanttContext();
    const [ isExpanded, setIsExpanded ] = useState(false);

    const { isOver: isRemoveOver, setNodeRef: setRemoveNodeRef } = useDroppable({
        id: `drop-remove-module-${moduleId}`,
        data: { targetType: 'remove', moduleId, eventId: null }
    });

    const hasEvents = useMemo(() => ganttModule?.events && ganttModule?.events.length > 0, [ ganttModule?.events ]);
    const mappedDays = useMemo(() => moduleMappings[ moduleId ] || [], [ moduleId, moduleMappings ]);
    const myViolations = useMemo(() => violations[ moduleId ] || [], [ moduleId, violations ]);

    const spanIndices = useMemo(() =>
    {
        const dayIds = new Set<string>();

        mappedDays.forEach(d => dayIds.add(d));

        if (hasEvents)
        {
            (ganttModule?.events ?? []).forEach(eId =>
            {
                const d = eventMappings[ eId ];
                if (d) dayIds.add(d);
            });
        }

        const indices = Array.from(dayIds).map(id => linearDays.indexOf(id)).filter(i => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [ hasEvents, ganttModule?.events, eventMappings, mappedDays, linearDays ]);

    const isUnmapped = spanIndices === null;
    const spanLength = spanIndices ? spanIndices.max - spanIndices.min + 1 : 1;

    return (
        <React.Fragment>
            <TableRow hover>
                <TableCell
                    ref={ setRemoveNodeRef }
                    sx={ {
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
                    } }
                >
                    { hasEvents ? <Box
                        component="span"
                        onClick={ () => setIsExpanded(!isExpanded) }
                        sx={ { fontSize: '0.8rem', width: 20, cursor: 'pointer', display: 'inline-block' } }
                    >
                        { isExpanded ? '▼' : '▶' }
                    </Box> : null }
                    { !hasEvents && <Box sx={ { width: 20, display: 'inline-block' } } /> }

                    <Box sx={ { flexGrow: 1, position: 'relative' } }>
                        { isUnmapped ? (
                            <GanttBlock
                                elementId={ `block-module-${moduleId}` }
                                id={ `drag-module-unmapped-${moduleId}` }
                                isAbsolute={ false }
                                payload={ { type: 'module-map', moduleId } }
                                spanLength={ 1 }
                                title={ ganttModule?.title }
                                violations={ myViolations }
                            />
                        ) : (
                            <Typography noWrap sx={ { lineHeight: '24px' } } variant="body2">{ ganttModule?.title }</Typography>
                        ) }
                    </Box>
                </TableCell>

                { timelineWeeks.map(week =>
                    week.days.map(dayId =>
                    {
                        const dayIndex = linearDays.indexOf(dayId);
                        const isSpanStart = spanIndices !== null && dayIndex === spanIndices.min;

                        return (
                            <GanttCell
                                blockId={ `drag-module-shift-${moduleId}-${dayId}` }
                                blockPayload={ { type: 'module-shift', moduleId, sourceDayId: dayId } }
                                blockTitle={ ganttModule?.title }
                                dayId={ dayId }
                                dropId={ `drop-module-${moduleId}-${dayId}` }
                                elementId={ isSpanStart ? `block-module-${moduleId}` : undefined }
                                hasBlock={ isSpanStart }
                                isAbsoluteBlock={ true }
                                isOpaque={ hasEvents ? isExpanded : undefined }
                                key={ `${dayId}-${moduleId}` }
                                payloadData={ { targetType: 'module', moduleId, dayId } }
                                spanLength={ spanLength }
                                violations={ isSpanStart ? myViolations : undefined }
                            />
                        );
                    })
                ) }
            </TableRow>

            { isExpanded && hasEvents ? ganttModule?.events?.map(eventId => (
                <GanttEventRow eventId={ eventId } key={ eventId } moduleId={ moduleId } />
            )) : null }
        </React.Fragment>
    );
};
