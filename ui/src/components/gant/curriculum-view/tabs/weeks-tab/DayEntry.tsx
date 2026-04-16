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
import { CurriculumId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gant/state/hooks/UseCurriculum";

interface DayEntryProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
    dayIndex: number;
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

export const DayEntry = React.memo(({ curriculumId, weekIndex, dayIndex }: DayEntryProps) =>
{
    const { enqueueSnackbar } = useSnackbar();
    const day = useCurriculumDay(curriculumId, weekIndex, dayIndex);
    const { updateDay } = useWeekActions();

    const [ localTime, setLocalTime ] = useState(() => formatToTime(day?.totalWorkingHours ?? 0));

    const handleSync = useCallback(() =>
    {
        const numericValue = parseToHours(localTime);
        if (numericValue !== day?.totalWorkingHours)
        {
            updateDay(curriculumId, weekIndex, dayIndex, { totalWorkingHours: numericValue })
                .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת שעות נכשלה!', error));
        }
    }, [ localTime, day?.totalWorkingHours, updateDay, curriculumId, weekIndex, dayIndex, enqueueSnackbar ]);

    const adjustHours = useCallback((amount: number) =>
    {
        const newHours = Math.max(0, Math.min(24, (day?.totalWorkingHours ?? 0) + amount));
        const formatted = formatToTime(newHours);
        setLocalTime(formatted); // Update local UI immediately
        updateDay(curriculumId, weekIndex, dayIndex, { totalWorkingHours: newHours })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת שעות נכשלה!', error));
    }, [ curriculumId, weekIndex, dayIndex, updateDay, day?.totalWorkingHours, enqueueSnackbar ]);

    const isSaturday = day?.day === DayName.Saturday;
    const isDisabled = isSaturday && (day?.totalWorkingHours ?? 0) === 0;

    return (
        <div className={ `
            group p-3 rounded-lg border border-transparent transition-all duration-150
            hover:border-slate-200 hover:bg-white hover:shadow-sm
            ${isDisabled ? 'bg-slate-50 opacity-40' : 'bg-slate-100/50'}
        `}>
            <div className="flex justify-between items-center">
                <Typography className="font-bold text-slate-600 tracking-tight" variant="caption">
                    { day?.day }
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
                onBlur={ (e) => updateDay(curriculumId, weekIndex, dayIndex, { comment: e.target.value }) }
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
