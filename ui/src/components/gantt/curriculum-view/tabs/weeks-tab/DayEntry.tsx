/**
 * Name: DayEntry.tsx
 * Purpose: Professional time-masked input with focus-based sync and key-reset.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { Add, Remove } from "@mui/icons-material";
import { IconButton, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { useCallback, useState } from 'react';

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CurriculumDayId, DayIndex } from "@/api-shared/types/gantt/curriculum";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gantt/state/hooks/UseCurriculumDay";

interface DayEntryProps
{
    dayId: CurriculumDayId;
}

const formatToTime = (hours: number): string =>
{
    const hh = Math.floor(hours);
    const mm = Math.round((hours - hh) * 60);
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
};

const parseToHours = (timeStr: string): number =>
{
    const parts = timeStr.split(':');
    const hh = parseInt(parts[ 0 ] || '0', 10);
    const mm = parseInt(parts[ 1 ] || '0', 10);
    return hh + (mm / 60);
};

export const DayEntry = React.memo(({ dayId }: DayEntryProps) =>
{
    const { enqueueSnackbar } = useSnackbar();
    const day = useCurriculumDay(dayId);
    const { updateDay } = useWeekActions();

    const [ localTime, setLocalTime ] = useState(() => formatToTime((day?.totalWorkingMinutes ?? 0) / 60));

    const handleSync = useCallback(() =>
    {
        const numericValue = parseToHours(localTime);
        if (numericValue !== day?.totalWorkingMinutes)
        {
            updateDay(dayId, { totalWorkingMinutes: numericValue })
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת שעות נכשלה!', error));
        }
    }, [ localTime, day?.totalWorkingMinutes, updateDay, dayId, enqueueSnackbar ]);

    const adjustHours = useCallback((amount: number) =>
    {
        const newMinutes = Math.max(0, Math.min(24 * 60, (day?.totalWorkingMinutes ?? 0) + (amount * 60)));
        const formatted = formatToTime(newMinutes / 60);
        setLocalTime(formatted); // Update local UI immediately
        updateDay(dayId, { totalWorkingMinutes: newMinutes })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת שעות נכשלה!', error));
    }, [ dayId, updateDay, day?.totalWorkingMinutes, enqueueSnackbar ]);

    const isSaturday = day?.dayIndex === DayIndex.Saturday;
    const isDisabled = isSaturday && (day?.totalWorkingMinutes ?? 0) === 0;

    return (
        <div className={ `
            group p-3 rounded-lg border border-transparent transition-all duration-150
            hover:border-slate-200 hover:bg-white hover:shadow-sm
            ${isDisabled ? 'bg-slate-50 opacity-40' : 'bg-slate-100/50'}
        `}>
            <div className="flex justify-between items-center">
                <Typography className="font-bold text-slate-600 tracking-tight" variant="caption">
                    { day?.title ?? 'יום' }
                </Typography>

                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-1 py-0.5 shadow-inner">
                    <IconButton
                        className="hover:text-red-500 transition-colors"
                        onClick={ () => adjustHours(-1) }
                        size="small"
                        sx={ { p: 0.25 } }
                    >
                        <Remove sx={ { fontSize: '1rem' } } />
                    </IconButton>

                    <input
                        className="w-12 text-center font-mono text-xs bg-transparent border-none focus:ring-0 focus:outline-none text-slate-800"
                        onBlur={ handleSync }
                        onChange={ (e) => setLocalTime(e.target.value) }
                        placeholder="00:00"
                        value={ localTime }
                    />

                    <IconButton
                        className="hover:text-blue-500 transition-colors"
                        onClick={ () => adjustHours(1) }
                        size="small"
                        sx={ { p: 0.25 } }
                    >
                        <Add sx={ { fontSize: '1rem' } } />
                    </IconButton>
                </div>
            </div>

            <TextField
                defaultValue={ day?.comment ?? '' }
                fullWidth
                onBlur={ (e) => updateDay(dayId, { comment: e.target.value }) }
                placeholder="הערות..."
                slotProps={ {
                    input: {
                        disableUnderline: true,
                        className: "text-[0.7rem] text-slate-500 hover:text-slate-800 transition-colors"
                    }
                } }
                variant="standard"
            />
        </div>
    );
});

DayEntry.displayName = 'DayEntry';
