import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import { KeyboardEvent } from 'react';

import { DaysTable } from './DaysTable';

import { CurriculumWeek } from '@/api-shared/types/gant/curriculum';

export interface WeekAccordionProps
{
    week: CurriculumWeek;
    weekIndex: number;
    canEdit: boolean;
    canAddDay: boolean;
    onAddDay: (weekIndex: number) => Promise<void>;
    onWeekCommentChange: (weekIndex: number, nextComment: string) => void;
    onWeekCommentSave: (weekIndex: number) => Promise<void>;
    onWeekCommentKeyDown: (event: KeyboardEvent<HTMLInputElement>, weekIndex: number) => void;
    onHoursChange: (weekIndex: number, dayIndex: number, nextValueRaw: string) => void;
    onHoursSave: (weekIndex: number, dayIndex: number) => Promise<void>;
    onHoursKeyDown: (event: KeyboardEvent<HTMLInputElement>, weekIndex: number, dayIndex: number) => void;
    onDayCommentChange: (weekIndex: number, dayIndex: number, nextComment: string) => void;
    onDayCommentSave: (weekIndex: number, dayIndex: number) => Promise<void>;
    onDayCommentKeyDown: (event: KeyboardEvent<HTMLInputElement>, weekIndex: number, dayIndex: number) => void;
}

export function WeekAccordion(props: WeekAccordionProps)
{
    const { week, weekIndex, canEdit, canAddDay } = props;

    return (
        <Box>
            <Box display="flex" justifyContent="flex-end" mb={ 1 }>
                <Tooltip title="הוספת יום">
                    <span>
                        <IconButton
                            size="small"
                            color="primary"
                            disabled={ !canEdit || !canAddDay }
                            onClick={ () => void props.onAddDay(weekIndex) }
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            <TextField
                size="small"
                label="הערת שבוע"
                placeholder="הוספת הערה לשבוע"
                value={ week.comment ?? '' }
                disabled={ !canEdit }
                onChange={ (event) => props.onWeekCommentChange(weekIndex, event.target.value) }
                onBlur={ () => void props.onWeekCommentSave(weekIndex) }
                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => props.onWeekCommentKeyDown(event, weekIndex) }
                fullWidth
                sx={ { mb: 1.5 } }
            />
            <DaysTable
                days={ week.days }
                canEdit={ canEdit }
                weekIndex={ weekIndex }
                onHoursChange={ props.onHoursChange }
                onHoursSave={ props.onHoursSave }
                onHoursKeyDown={ props.onHoursKeyDown }
                onDayCommentChange={ props.onDayCommentChange }
                onDayCommentSave={ props.onDayCommentSave }
                onDayCommentKeyDown={ props.onDayCommentKeyDown }
            />
        </Box>
    );
}
