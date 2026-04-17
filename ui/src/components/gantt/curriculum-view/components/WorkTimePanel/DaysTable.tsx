import { Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { KeyboardEvent } from 'react';

import { CurriculumDay } from '@/api-shared/types/gantt/curriculum';

export interface DaysTableProps
{
    days: CurriculumDay[];
    canEdit: boolean;
    weekIndex: number;
    onHoursChange: (weekIndex: number, dayIndex: number, nextValueRaw: string) => void;
    onHoursSave: (weekIndex: number, dayIndex: number) => Promise<void>;
    onHoursKeyDown: (event: KeyboardEvent<HTMLInputElement>, weekIndex: number, dayIndex: number) => void;
    onDayCommentChange: (weekIndex: number, dayIndex: number, nextComment: string) => void;
    onDayCommentSave: (weekIndex: number, dayIndex: number) => Promise<void>;
    onDayCommentKeyDown: (event: KeyboardEvent<HTMLInputElement>, weekIndex: number, dayIndex: number) => void;
}

export function DaysTable({
    days,
    canEdit,
    weekIndex,
    onHoursChange,
    onHoursSave,
    onHoursKeyDown,
    onDayCommentChange,
    onDayCommentSave,
    onDayCommentKeyDown,
}: DaysTableProps)
{
    return (
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>יום</TableCell>
                    <TableCell align="right">שעות עבודה</TableCell>
                    <TableCell>הערה</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                { days.map((day, dayIndex) => (
                    <TableRow key={ `${weekIndex}-${day.dayIndex}` }>
                        <TableCell>
                            <Typography variant="body2">{ day.title }</Typography>
                        </TableCell>
                        <TableCell align="right">
                            <TextField
                                disabled={ !canEdit }
                                inputProps={ { min: 0, step: 0.5 } }
                                onBlur={ () => void onHoursSave(weekIndex, dayIndex) }
                                onChange={ (event) => onHoursChange(weekIndex, dayIndex, event.target.value) }
                                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => onHoursKeyDown(event, weekIndex, dayIndex) }
                                size="small"
                                sx={ { width: '8rem' } }
                                type="number"
                                value={ day.totalWorkingMinutes }
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                disabled={ !canEdit }
                                fullWidth
                                onBlur={ () => void onDayCommentSave(weekIndex, dayIndex) }
                                onChange={ (event) => onDayCommentChange(weekIndex, dayIndex, event.target.value) }
                                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => onDayCommentKeyDown(event, weekIndex, dayIndex) }
                                placeholder="הערת יום"
                                size="small"
                                value={ day.comment ?? '' }
                            />
                        </TableCell>
                    </TableRow>
                )) }
            </TableBody>
        </Table>
    );
}
