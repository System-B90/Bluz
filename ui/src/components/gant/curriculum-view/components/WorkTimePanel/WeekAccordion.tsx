import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, TextField, Tooltip } from '@mui/material';
import { KeyboardEvent } from 'react';

import { CurriculumWeek } from '@/api-shared/types/gant/curriculum';
import { DaysTable } from '@/components/gant/curriculum-view/components/WorkTimePanel/DaysTable';

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
                            color="primary"
                            disabled={ !canEdit || !canAddDay }
                            onClick={ () => void props.onAddDay(weekIndex) }
                            size="small"
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            <TextField
                disabled={ !canEdit }
                fullWidth
                label="הערת שבוע"
                onBlur={ () => void props.onWeekCommentSave(weekIndex) }
                onChange={ (event) => props.onWeekCommentChange(weekIndex, event.target.value) }
                onKeyDown={ (event: KeyboardEvent<HTMLInputElement>) => props.onWeekCommentKeyDown(event, weekIndex) }
                placeholder="הוספת הערה לשבוע"
                size="small"
                sx={ { mb: 1.5 } }
                value={ week.comment ?? '' }
            />
            <DaysTable
                canEdit={ canEdit }
                days={ week.days }
                onDayCommentChange={ props.onDayCommentChange }
                onDayCommentKeyDown={ props.onDayCommentKeyDown }
                onDayCommentSave={ props.onDayCommentSave }
                onHoursChange={ props.onHoursChange }
                onHoursKeyDown={ props.onHoursKeyDown }
                onHoursSave={ props.onHoursSave }
                weekIndex={ weekIndex }
            />
        </Box>
    );
}
