import { Box, TableCell, TableRow, Typography, useTheme } from '@mui/material';
import React, { useMemo, useState } from 'react';

import { useGanttContext } from './context';
import { GanttModuleRow } from './GanttModuleRow';
import { GanttSyllabusGroupProps, SpanVariant } from './types';

import { useCurriculumState } from '@/components/gantt/state/provider';

export const GanttSyllabusGroup: React.FC<GanttSyllabusGroupProps> = ({ syllabusId }) =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { timelineWeeks, linearDays, moduleMappings, eventMappings } = useGanttContext();
    const [ isExpanded, setIsExpanded ] = useState(true);

    const syllabus = state.syllabuses[ syllabusId ];
    if (!syllabus) return null;

    const spanIndices = useMemo(() =>
    {
        const allMappedDays = new Set<string>();

        syllabus.modules.forEach(moduleId =>
        {
            const module = state.modules[ moduleId ];
            if (!module) return;

            const mDays = moduleMappings[ moduleId ] || [];
            mDays.forEach(d => allMappedDays.add(d));

            if (module.events)
            {
                module.events.forEach(eId =>
                {
                    const eDay = eventMappings[ eId ];
                    if (eDay) allMappedDays.add(eDay);
                });
            }
        });

        const indices = Array.from(allMappedDays).map(id => linearDays.indexOf(id)).filter(i => i !== -1);
        if (indices.length === 0) return null;
        return { min: Math.min(...indices), max: Math.max(...indices) };
    }, [ syllabus, state.modules, moduleMappings, eventMappings, linearDays ]);

    return (
        <React.Fragment>
            <TableRow
                hover
                onClick={ () => setIsExpanded(!isExpanded) }
                sx={ { cursor: 'pointer' } }
            >
                <TableCell
                    sx={ {
                        width: 250,
                        minWidth: 250,
                        maxWidth: 250,
                        boxSizing: 'border-box',
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                        backgroundColor: theme.palette.background.default,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderBottom: `1px solid ${theme.palette.divider}`
                    } }
                >
                    <Typography sx={ { display: 'flex', alignItems: 'center', gap: 1 } } variant="subtitle2">
                        <Box component="span" sx={ { fontSize: '0.8rem', width: 16 } }>
                            { isExpanded ? '▼' : '▶' }
                        </Box>
                        { syllabus.title }
                    </Typography>
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

                        const getSpanBorderRadius = () =>
                        {
                            switch (spanVariant)
                            {
                            case 'start': return '4px 0 0 4px';
                            case 'end': return '0 4px 4px 0';
                            case 'single': return '4px';
                            default: return '0';
                            }
                        };

                        return (
                            <TableCell
                                key={ dayId }
                                sx={ {
                                    backgroundColor: theme.palette.background.default,
                                    borderLeft: `1px solid ${theme.palette.divider}`,
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                    p: 0,
                                    width: 80,
                                    minWidth: 80,
                                    maxWidth: 80,
                                    boxSizing: 'border-box',
                                    position: 'relative'
                                } }
                            >
                                { spanVariant !== 'none' && (
                                    <Box
                                        sx={ {
                                            position: 'absolute',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            left: spanVariant === 'middle' || spanVariant === 'end' ? '-1px' : '4px',
                                            right: spanVariant === 'middle' || spanVariant === 'start' ? '-1px' : '4px',
                                            height: '8px',
                                            backgroundColor: theme.palette.text.secondary,
                                            opacity: 0.2,
                                            borderRadius: getSpanBorderRadius(),
                                            zIndex: 1,
                                        } }
                                    />
                                ) }
                            </TableCell>
                        );
                    })
                ) }
            </TableRow>

            { isExpanded ? syllabus.modules.map(moduleId => (
                <GanttModuleRow key={ moduleId } moduleId={ moduleId } />
            )) : null }
        </React.Fragment>
    );
};
