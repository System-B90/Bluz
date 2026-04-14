/**
 * Name: DayEntry.tsx
 * Purpose: Condensed editable row with 15m granularity and Tailwind styling.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumDay, CurriculumId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gant/state/hooks/UseCurriculum";
import { InputAdornment, TextField, Typography } from "@mui/material";
import React, { useCallback } from 'react';

interface DayEntryProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
    dayIndex: number;
}

export const DayEntry = React.memo(({ curriculumId, weekIndex, dayIndex }: DayEntryProps) =>
{
    const day = useCurriculumDay(curriculumId, weekIndex, dayIndex);
    const { updateDay } = useWeekActions();

    const handleUpdateDay = useCallback((field: keyof CurriculumDay, value: string | number) =>
    {
        updateDay(curriculumId, weekIndex, dayIndex, { [ field ]: value });
    }, [ curriculumId, weekIndex, dayIndex, updateDay ]);

    const isSaturday = day?.day === DayName.Saturday;
    const isDisabled = isSaturday && day?.totalWorkingHours === 0;

    return (
        <div className={ `
            p-2 rounded transition-all duration-200 bg-black/5
            ${isDisabled ? 'opacity-40 grayscale' : 'opacity-100 grayscale-0'}
        `}>
            <div className="flex justify-between items-center mb-1">
                <Typography variant="caption" className="font-semibold uppercase tracking-wider">
                    { day?.day }
                </Typography>

                <TextField
                    variant="standard"
                    type="number"
                    size="small"
                    value={ day?.totalWorkingHours ?? 0 }
                    onChange={ (e) => handleUpdateDay('totalWorkingHours', parseFloat(e.target.value)) }
                    slotProps={ {
                        input: {
                            endAdornment: <InputAdornment position="end" className="select-none">h</InputAdornment>,
                            className: "text-[0.75rem] w-[75px]"
                        },
                        htmlInput: {
                            max: 24,
                            min: 0,
                            step: 0.25, // Allows 15min granularity (0.25, 0.5, 0.75)
                        },
                    } }
                />
            </div>

            <TextField
                fullWidth
                placeholder="Add comment..."
                variant="standard"
                size="small"
                value={ day?.comment ?? '' }
                onChange={ (e) => handleUpdateDay('comment', e.target.value) }
                autoComplete="off"
                sx={ {
                    '& .MuiInput-input': {
                        fontSize: '0.7rem',
                        paddingY: '2px'
                    }
                } }
            />
        </div>
    );
});

DayEntry.displayName = 'DayEntry';
