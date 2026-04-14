/**
 * Name: DayEntry.tsx
 * Purpose: Time-masked editable row with whole-hour increments and 15m manual granularity.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { CurriculumDay, CurriculumId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gant/state/hooks/UseCurriculum";
import { Add, Remove } from "@mui/icons-material";
import { IconButton, InputAdornment, TextField, Typography } from "@mui/material";
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

    const currentHours = day?.totalWorkingHours ?? 0;

    const handleUpdateDay = useCallback((field: keyof CurriculumDay, value: string | number) =>
    {
        updateDay(curriculumId, weekIndex, dayIndex, { [ field ]: value });
    }, [ curriculumId, weekIndex, dayIndex, updateDay ]);

    // Button Logic: Only increments by whole hours
    const adjustHours = (amount: number) =>
    {
        const newValue = Math.max(0, Math.min(24, currentHours + amount));
        handleUpdateDay('totalWorkingHours', newValue);
    };

    const isSaturday = day?.day === DayName.Saturday;
    const isDisabled = isSaturday && currentHours === 0;

    return (
        <div className={ `
            p-2 rounded transition-all duration-200 bg-black/5
            ${isDisabled ? 'opacity-40 grayscale' : 'opacity-100 grayscale-0'}
        `}>
            <div className="flex justify-between items-center mb-1">
                <Typography variant="caption" className="font-semibold uppercase tracking-wider text-slate-500">
                    { day?.day }
                </Typography>

                <div className="flex items-center gap-1 bg-white/50 rounded-md px-1">
                    <IconButton size="small" onClick={ () => adjustHours(-1) } className="p-0.5">
                        <Remove sx={ { fontSize: '0.9rem' } } />
                    </IconButton>

                    <TextField
                        variant="standard"
                        size="small"
                        value={ currentHours }
                        onChange={ (e) =>
                        {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) handleUpdateDay('totalWorkingHours', val);
                        } }
                        placeholder="0.00"
                        slotProps={ {
                            input: {
                                disableUnderline: true,
                                endAdornment: <InputAdornment position="end" className="select-none text-[0.6rem]">h</InputAdornment>,
                                className: "text-[0.75rem] w-[50px] font-mono text-center"
                            },
                            htmlInput: {
                                step: 0.25, // Internal granularity
                                min: 0,
                                max: 24,
                                type: 'number' // Still provides internal validation
                            }
                        } }
                        sx={ {
                            '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                display: 'none' // Hide default browser arrows for custom ones
                            }
                        } }
                    />

                    <IconButton size="small" onClick={ () => adjustHours(1) } className="p-0.5">
                        <Add sx={ { fontSize: '0.9rem' } } />
                    </IconButton>
                </div>
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
