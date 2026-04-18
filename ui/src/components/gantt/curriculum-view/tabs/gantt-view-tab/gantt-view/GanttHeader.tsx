import { TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import React from 'react';

import { useGanttContext } from './context';

import { getDayNameDisplay } from '@/api-shared/types/gantt/models';
import { useCurriculumState } from '@/components/gantt/state/provider';

export const GanttHeader: React.FC = () =>
{
    const theme = useTheme();
    const state = useCurriculumState();
    const { timelineWeeks } = useGanttContext();

    return (
        <TableHead>
            <TableRow>
                <TableCell
                    rowSpan={ 2 }
                    sx={ {
                        width: 250,
                        minWidth: 250,
                        maxWidth: 250,
                        boxSizing: 'border-box',
                        backgroundColor: theme.palette.background.paper,
                        position: 'sticky',
                        left: 0,
                        top: 0,
                        zIndex: 3,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderBottom: `1px solid ${theme.palette.divider}`
                    } }
                >
                    <Typography fontWeight="bold" variant="subtitle2">Syllabus / Module</Typography>
                </TableCell>
                { timelineWeeks.map(week => (
                    <TableCell
                        align="center"
                        colSpan={ week.days.length }
                        key={ week.id }
                        sx={ {
                            borderLeft: `1px solid ${theme.palette.divider}`,
                            backgroundColor: theme.palette.background.paper,
                            zIndex: 2
                        } }
                    >
                        <Typography fontWeight="bold" variant="subtitle2">{ week.title }</Typography>
                    </TableCell>
                )) }
            </TableRow>
            <TableRow>
                { timelineWeeks.map(week =>
                    week.days.map(dayId =>
                    {
                        const day = state.days[ dayId ];
                        if (!day) return null;
                        return (
                            <TableCell
                                align="center"
                                key={ dayId }
                                sx={ {
                                    width: 80,
                                    minWidth: 80,
                                    maxWidth: 80,
                                    boxSizing: 'border-box',
                                    borderLeft: `1px solid ${theme.palette.divider}`,
                                    backgroundColor: theme.palette.background.paper,
                                    zIndex: 2
                                } }
                            >
                                <Typography variant="caption">{ getDayNameDisplay(day.dayIndex) }</Typography>
                            </TableCell>
                        );
                    })
                ) }
            </TableRow>
        </TableHead>
    );
};
