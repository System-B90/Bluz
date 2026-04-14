/**
 * Name: DayEntry.tsx
 * Purpose: Condensed editable row for a single curriculum day.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { CurriculumDays, DayName } from "@/api-shared/types/gant/curriculum";
import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import React from 'react';

interface DayEntryProps
{
    day: CurriculumDays;
    onUpdate: (dayName: DayName, field: keyof CurriculumDays, value: string | number) => void;
}

export const DayEntry = React.memo(({ day, onUpdate }: DayEntryProps) =>
{
    const isSaturday = day.day === DayName.Saturday;
    const isDisabled = isSaturday && day.totalWorkingHours === 0;

    return (
        <Box
            sx={ {
                opacity: isDisabled ? 0.4 : 1,
                filter: isDisabled ? 'grayscale(1)' : 'none',
                p: 1,
                bgcolor: 'action.hover',
                borderRadius: 1
            } }
        >
            <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 } }>
                <Typography variant="caption" sx={ { fontWeight: 600 } }>
                    { day.day }
                </Typography>
                <TextField
                    variant="standard"
                    type="number"
                    size="small"
                    value={ day.totalWorkingHours }
                    onChange={ (e) => onUpdate(day.day, 'totalWorkingHours', Number(e.target.value)) }
                    InputProps={ {
                        endAdornment: <InputAdornment position="end">h</InputAdornment>,
                        sx: { fontSize: '0.75rem', width: '50px' }
                    } }
                />
            </Box>
            <TextField
                fullWidth
                placeholder="Add comment..."
                variant="standard"
                size="small"
                value={ day.comment || '' }
                onChange={ (e) => onUpdate(day.day, 'comment', e.target.value) }
                sx={ { '& .MuiInput-input': { fontSize: '0.7rem' } } }
            />
        </Box>
    );
});
DayEntry.displayName = 'DayEntry';
