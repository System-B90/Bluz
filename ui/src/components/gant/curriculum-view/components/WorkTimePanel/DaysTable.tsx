import { CurriculumDays } from '@/api-shared/types/gant/curriculum';
import { KeyboardEvent } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';

export interface DaysTableProps
{
    days: CurriculumDays[];
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
                    <TableRow key={ `${weekIndex}-${day.day}` }>
                        <TableCell>
                            <Typography variant="body2">{ day.day }</Typography>
                        </TableCell>
                        <TableCell align="right">
                            <TextField
                                size="small"
                                type="number"
                                value={ day.totalWorkingHours }
                                disabled={ !canEdit }
                                onChange={ (event) => onHoursChange(weekIndex, dayIndex, event.target.value) }
                                onBlur={ () => void onHoursSave(weekIndex, dayIndex) }
                                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => onHoursKeyDown(event, weekIndex, dayIndex) }
                                inputProps={ { min: 0, step: 0.5 } }
                                sx={ { width: '8rem' } }
                            />
                        </TableCell>
                        <TableCell>
                            <TextField
                                size="small"
                                value={ day.comment ?? '' }
                                placeholder="הערת יום"
                                disabled={ !canEdit }
                                onChange={ (event) => onDayCommentChange(weekIndex, dayIndex, event.target.value) }
                                onBlur={ () => void onDayCommentSave(weekIndex, dayIndex) }
                                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => onDayCommentKeyDown(event, weekIndex, dayIndex) }
                                fullWidth
                            />
                        </TableCell>
                    </TableRow>
                )) }
            </TableBody>
        </Table>
    );
}
