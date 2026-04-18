import { useGanttMappings } from '@/components/gantt/state/mappings/hooks';
import { useCurriculumState } from '@/components/gantt/state/provider';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { Box, Paper, Table, TableBody, TableContainer, Typography, useTheme } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { GanttContext } from './context';
import { GanttHeader } from './GanttHeader';
import { GanttSyllabusGroup } from './GanttSyllabusGroup';
import { GanttViewProps } from './types';

export const GanttView: React.FC<GanttViewProps> = ({ curriculumId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { state: { mappings: globalMappings }, createMapping, moveMapping, removeMapping } = useGanttMappings();
    const curriculum = state.curriculums[ curriculumId ];

    const timelineWeeks = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.weeks.map(weekId => state.weeks[ weekId ]).filter(w => !!w);
    }, [ curriculum, state.weeks ]);

    const linearDays = useMemo(() =>
    {
        return timelineWeeks.flatMap(w => w.days);
    }, [ timelineWeeks ]);

    const moduleMappings = useMemo(() =>
    {
        const merged: Record<string, string[]> = {};

        Object.values(globalMappings).forEach((mapping: any) =>
        {
            if (mapping.curriculumId !== curriculumId) return;
            if (!mapping.eventId)
            {
                const arr = merged[ mapping.moduleId ] || [];
                if (!arr.includes(mapping.dayId))
                {
                    merged[ mapping.moduleId ] = [ ...arr, mapping.dayId ];
                }
            }
        });

        return merged;
    }, [ globalMappings, curriculumId ]);

    const eventMappings = useMemo(() =>
    {
        const merged: Record<string, string> = {};

        Object.values(globalMappings).forEach((mapping: any) =>
        {
            if (mapping.curriculumId !== curriculumId) return;
            if (mapping.eventId)
            {
                merged[ mapping.eventId ] = mapping.dayId;
            }
        });

        return merged;
    }, [ globalMappings, curriculumId ]);

    const handleMapModule = useCallback(async (moduleId: string, dayId: string) =>
    {
        await createMapping({ moduleId, eventId: null, dayId });
    }, [ createMapping ]);

    const handleMapEvent = useCallback(async (moduleId: string, eventId: string, dayId: string) =>
    {
        await createMapping({ moduleId, eventId, dayId });
    }, [ createMapping ]);

    const handleMoveModule = useCallback(async (moduleId: string, sourceDayId: string, targetDayId: string) =>
    {
        await moveMapping({ moduleId, eventId: null, from: { d: sourceDayId }, to: { d: targetDayId } });
    }, [ moveMapping ]);

    const handleMoveEvent = useCallback(async (moduleId: string, eventId: string, sourceDayId: string, targetDayId: string) =>
    {
        await moveMapping({ moduleId, eventId, from: { d: sourceDayId }, to: { d: targetDayId } });
    }, [ moveMapping ]);

    const handleShiftModule = useCallback(async (moduleId: string, deltaDays: number) =>
    {
        if (deltaDays === 0) return;

        const module = state.modules[ moduleId ];
        const promises: Promise<void>[] = [];

        const mDays = moduleMappings[ moduleId ] || [];
        mDays.forEach(dayId =>
        {
            const currentIdx = linearDays.indexOf(dayId);
            const newIdx = currentIdx + deltaDays;
            const targetDayId = linearDays[ newIdx ];
            if (targetDayId)
            {
                promises.push(moveMapping({ moduleId, eventId: null, from: { d: dayId }, to: { d: targetDayId } }));
            }
        });

        if (module && module.events)
        {
            module.events.forEach(eventId =>
            {
                const currentDayId = eventMappings[ eventId ];
                if (currentDayId)
                {
                    const currentIdx = linearDays.indexOf(currentDayId);
                    const newIdx = currentIdx + deltaDays;
                    const targetDayId = linearDays[ newIdx ];
                    if (targetDayId)
                    {
                        promises.push(moveMapping({ moduleId, eventId, from: { d: currentDayId }, to: { d: targetDayId } }));
                    }
                }
            });
        }

        await Promise.all(promises);
    }, [ linearDays, state.modules, moduleMappings, eventMappings, moveMapping ]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) =>
    {
        const { active, over } = event;
        if (!over) return;

        const payload = active.data.current;
        const target = over.data.current;

        if (!payload || !target) return;

        if (target.targetType === 'remove')
        {
            if (payload.type === 'module-move' || payload.type === 'module-shift')
            {
                const mDays = moduleMappings[ payload.moduleId ] || [];
                const promises: Promise<void>[] = [];

                mDays.forEach(d =>
                {
                    promises.push(removeMapping({ moduleId: payload.moduleId, eventId: null, dayId: d }));
                });

                const module = state.modules[ payload.moduleId ];
                if (module && module.events)
                {
                    module.events.forEach(eId =>
                    {
                        const d = eventMappings[ eId ];
                        if (d)
                        {
                            promises.push(removeMapping({ moduleId: payload.moduleId, eventId: eId, dayId: d }));
                        }
                    });
                }
                await Promise.all(promises);
            } else if (payload.type === 'event-move')
            {
                await removeMapping({ moduleId: payload.moduleId, eventId: payload.eventId, dayId: payload.sourceDayId });
            }
            return;
        }

        if (payload.type === 'module-map' && target.targetType === 'module')
        {
            await handleMapModule(payload.moduleId, target.dayId);
        }
        else if (payload.type === 'event-map' && target.targetType === 'event')
        {
            await handleMapEvent(payload.moduleId, payload.eventId, target.dayId);
        }
        else if (payload.type === 'module-move' && target.targetType === 'module')
        {
            if (payload.sourceDayId !== target.dayId)
            {
                await handleMoveModule(payload.moduleId, payload.sourceDayId, target.dayId);
            }
        }
        else if (payload.type === 'module-shift' && target.targetType === 'module')
        {
            const sourceIdx = linearDays.indexOf(payload.sourceDayId);
            const targetIdx = linearDays.indexOf(target.dayId);
            const deltaDays = targetIdx - sourceIdx;

            if (deltaDays !== 0)
            {
                await handleShiftModule(payload.moduleId, deltaDays);
            }
        }
        else if (payload.type === 'event-move' && target.targetType === 'event')
        {
            if (payload.sourceDayId !== target.dayId)
            {
                await handleMoveEvent(payload.moduleId, payload.eventId, payload.sourceDayId, target.dayId);
            }
        }
    }, [ handleMapModule, handleMapEvent, handleMoveModule, handleMoveEvent, handleShiftModule, linearDays, moduleMappings, eventMappings, removeMapping, state.modules ]);

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
                eventMappings,
                onMapModule: handleMapModule,
                onMapEvent: handleMapEvent,
                onMoveModule: handleMoveModule,
                onMoveEvent: handleMoveEvent,
                onShiftModule: handleShiftModule
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