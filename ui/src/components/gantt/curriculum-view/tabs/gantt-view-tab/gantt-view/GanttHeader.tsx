import { getDayNameDisplay } from '@/api-shared/types/gantt/models';
import { useCurriculumState } from '@/components/gantt/state/provider';
import { TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useGanttContext } from './context';

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
                        // Elevated zIndex to stay above horizontal scrolls entirely
                        zIndex: 6,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        borderBottom: `1px solid ${theme.palette.divider}`
                    } }
                >
                    <Typography variant="subtitle2" fontWeight="bold">Syllabus / Module</Typography>
                </TableCell>
                { timelineWeeks.map(week => (
                    <TableCell
                        key={ week.id }
                        colSpan={ week.days.length }
                        align="center"
                        sx={ {
                            borderLeft: `1px solid ${theme.palette.divider}`,
                            backgroundColor: theme.palette.background.paper,
                            zIndex: 2
                        } }
                    >
                        <Typography variant="subtitle2" fontWeight="bold">{ week.title }</Typography>
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
                                key={ dayId }
                                align="center"
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