/**
 * Name: ClosingSaturdayChip.tsx
 * Purpose: Interactive toggle for weekend/Saturday status with high visual clarity.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { EventAvailable, EventBusy } from "@mui/icons-material";
import { Chip, Tooltip } from "@mui/material";
import { useCallback } from 'react';

import { CurriculumId, DayName } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculum";

interface ClosingSaturdayChipProps
{
    curriculumId: CurriculumId;
    weekIndex: number;
    closingSaturday: boolean;
}

export function ClosingSaturdayChip({
    curriculumId,
    weekIndex,
    closingSaturday
}: ClosingSaturdayChipProps)
{
    const week = useCurriculumWeek(curriculumId, weekIndex);
    const { updateWeek } = useWeekActions();

    const clickHandler = useCallback(() =>
    {
        if (!week) { return; }
        const isClosing = !closingSaturday;
        const updatedDays = [ ...week.days.filter(d => (isClosing ? true : d.day !== DayName.Saturday)) ];
        if (isClosing)
        {
            updatedDays.push({ day: DayName.Saturday, totalWorkingHours: 2 });
        }
        updateWeek(curriculumId, weekIndex, { closingSaturday: isClosing, days: updatedDays });
    }, [ week, curriculumId, weekIndex, closingSaturday, updateWeek ]);

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
