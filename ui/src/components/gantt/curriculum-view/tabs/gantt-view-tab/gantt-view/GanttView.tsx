import { useCurriculumMappings } from '@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';
import { useCurriculumState } from '@/components/gantt/state/provider';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { Box, Paper, Table, TableBody, TableContainer, Typography, useTheme } from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { GanttContext } from './context';
import { GanttHeader } from './GanttHeader';
import { GanttSyllabusGroup } from './GanttSyllabusGroup';
import { GanttViewProps } from './types';

export const GanttView: React.FC<GanttViewProps> = ({ curriculumId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { state: { mappings: globalMappings } } = useCurriculumMappings();
    const curriculum = state.curriculums[ curriculumId ];

    // Local PoC State for dragging entities without backend persistence yet
    const [ localModuleMappings, setLocalModuleMappings ] = useState<Record<string, string[]>>({});
    const [ localEventMappings, setLocalEventMappings ] = useState<Record<string, string>>({});

    const timelineWeeks = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.weeks.map(weekId => state.weeks[ weekId ]).filter(w => !!w);
    }, [ curriculum, state.weeks ]);

    const linearDays = useMemo(() =>
    {
        return timelineWeeks.flatMap(w => w.days);
    }, [ timelineWeeks ]);

    // Merge global mappings with local PoC mapped modules
    const moduleMappings = useMemo(() =>
    {
        const merged: Record<string, string[]> = { ...localModuleMappings };

        // Parse the global mappings (key format: dayId-moduleId)
        Object.keys(globalMappings).forEach(key =>
        {
            const mapping = globalMappings[ key ];
            if (mapping.curriculumId !== curriculumId) return;

            const arr = merged[ mapping.moduleId ] || [];
            if (!arr.includes(mapping.dayId))
            {
                merged[ mapping.moduleId ] = [ ...arr, mapping.dayId ];
            }
        });

        return merged;
    }, [ globalMappings, localModuleMappings, curriculumId ]);

    const handleMapModule = useCallback((moduleId: string, dayId: string) =>
    {
        setLocalModuleMappings(prev => ({ ...prev, [ moduleId ]: [ dayId ] }));
    }, []);

    const handleMoveModule = useCallback((moduleId: string, sourceDayId: string, targetDayId: string) =>
    {
        setLocalModuleMappings(prev =>
        {
            const existing = prev[ moduleId ] || [];
            return { ...prev, [ moduleId ]: [ ...existing.filter(id => id !== sourceDayId), targetDayId ] };
        });
    }, []);

    const handleMoveEvent = useCallback((eventId: string, dayId: string) =>
    {
        setLocalEventMappings(prev => ({ ...prev, [ eventId ]: dayId }));
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) =>
    {
        const { active, over } = event;
        if (!over) return;

        const payload = active.data.current;
        const target = over.data.current;

        if (!payload || !target) return;

        if (payload.type === 'module-map' && target.targetType === 'module')
        {
            handleMapModule(payload.moduleId, target.dayId);
        }
        else if (payload.type === 'module-move' && target.targetType === 'module')
        {
            if (payload.sourceDayId !== target.dayId)
            {
                handleMoveModule(payload.moduleId, payload.sourceDayId, target.dayId);
            }
        }
        else if (payload.type === 'event-move' && target.targetType === 'event')
        {
            if (payload.sourceDayId !== target.dayId)
            {
                handleMoveEvent(payload.eventId, target.dayId);
            }
        }
    }, [ handleMapModule, handleMoveModule, handleMoveEvent ]);

    if (!curriculum)
    {
        return <Typography sx={ { p: 2 } }>Loading curriculum...</Typography>;
    }

    return (
        <DndContext onDragEnd={ handleDragEnd }>
            <GanttContext.Provider value={ {
                timelineWeeks,
                linearDays,
                moduleMappings,
                eventMappings: localEventMappings,
                onMapModule: handleMapModule,
                onMoveModule: handleMoveModule,
                onMoveEvent: handleMoveEvent
            } }>
                <Box sx={ { width: '100%', overflow: 'hidden', mt: 2 } }>
                    <Paper sx={ { width: '100%', maxHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }>

                        <Box sx={ { p: 2, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 } }>
                            <Typography variant="h6">{ curriculum.title }</Typography>
                            <Typography variant="body2" color="text.secondary">
                                { curriculum.description }
                            </Typography>
                        </Box>

                        <TableContainer sx={ { flexGrow: 1, overflow: 'auto', minWidth: 0, minHeight: 0 } }>
                            <Table size="small" stickyHeader sx={ { width: 'max-content', tableLayout: 'fixed' } }>
                                <GanttHeader />
                                <TableBody>
                                    { curriculum.syllabuses.map(syllabusId => (
                                        <GanttSyllabusGroup key={ syllabusId } syllabusId={ syllabusId } />
                                    )) }
                                </TableBody>
                            </Table>
                        </TableContainer>

                    </Paper>
                </Box>
            </GanttContext.Provider>
        </DndContext>
    );
};