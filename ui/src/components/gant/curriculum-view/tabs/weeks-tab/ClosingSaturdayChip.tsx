/**
 * Name: ClosingSaturdayChip.tsx
 * Purpose: Interactive toggle for weekend/Saturday status with high visual clarity.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { EventAvailable, EventBusy } from "@mui/icons-material";
import { Chip, Tooltip } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback } from 'react';

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CurriculumDayId, CurriculumWeekId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculumWeek";
import { useCurriculumState } from "@/components/gant/state/provider";

interface ClosingSaturdayChipProps
{
    weekId: CurriculumWeekId;
    closingSaturday: boolean;
}

export function ClosingSaturdayChip({
    weekId,
    closingSaturday
}: ClosingSaturdayChipProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const week = useCurriculumWeek(weekId);
    const state = useCurriculumState();
    const { updateWeekDays } = useWeekActions();

    const clickHandler = useCallback(() =>
    {
        if (!week) { return; }
        const isClosing = !closingSaturday;
        
        // Get current days and filter/add Saturday
        const currentDayIds = (week.days ?? []) as CurriculumDayId[];
        const updatedDayIds: CurriculumDayId[] = [];
        
        for (const dayId of currentDayIds) {
            const day = state.days[dayId];
            if (day && (isClosing ? true : day.day !== DayName.Saturday)) {
                updatedDayIds.push(dayId);
            }
        }
        
        // If closing, add Saturday with 2 hours - for now we'll just update closingSaturday
        // The actual day creation would happen during API update
        updateWeekDays(weekId, { closingSaturday: isClosing, dayIds: updatedDayIds })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המידע של השבוע נכשלה!', error));
    }, [ week, weekId, closingSaturday, updateWeekDays, enqueueSnackbar, state.days ]);

    return (
        <Tooltip arrow title={ closingSaturday ? "סוגרים שבת" : "יוצאים הביתה" }>
            <Chip
                className={ `
                    transition-all duration-300 ease-in-out cursor-pointer font-bold
                    ${closingSaturday
                        ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md ring-2 ring-amber-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }
                `}
                icon={ closingSaturday ?
                    <EventBusy className="text-white" /> :
                    <EventAvailable className="text-slate-500" />
                }
                label={ closingSaturday ? "סוגרים" : "יוצאים" }
                onClick={ clickHandler }
                sx={ {
                    height: 28,
                    '& .MuiChip-label': { px: 1.5, fontSize: '0.75rem' },
                    '& .MuiChip-icon': { fontSize: '1.1rem', ml: '8px' }
                } }
            />
        </Tooltip>
    );
}
