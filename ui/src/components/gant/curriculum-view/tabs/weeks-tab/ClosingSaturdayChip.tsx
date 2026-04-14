/**
 * Name: ClosingSaturdayChip.tsx
 * Purpose: Interactive toggle for weekend/Saturday status with high visual clarity.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { EventAvailable, EventBusy } from "@mui/icons-material";
import { Chip, Tooltip } from "@mui/material";
import { useCallback } from 'react';

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
    const { updateWeek } = useWeekActions();

    const clickHandler = useCallback(() =>
    {
        updateWeek(curriculumId, weekIndex, { closingSaturday: !closingSaturday });
    }, [ curriculumId, weekIndex, closingSaturday, updateWeek ]);

    return (
        <Tooltip title={ closingSaturday ? "סוגרים שבת" : "יוצאים הביתה" } arrow>
            <Chip
                onClick={ clickHandler }
                icon={ closingSaturday ?
                    <EventBusy className="text-white" /> :
                    <EventAvailable className="text-slate-500" />
                }
                label={ closingSaturday ? "סוגרים" : "יוצאים" }
                className={ `
                    transition-all duration-300 ease-in-out cursor-pointer font-bold
                    ${closingSaturday
                        ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md ring-2 ring-amber-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }
                `}
                sx={ {
                    height: 28,
                    '& .MuiChip-label': { px: 1.5, fontSize: '0.75rem' },
                    '& .MuiChip-icon': { fontSize: '1.1rem', ml: '8px' }
                } }
            />
        </Tooltip>
    );
}
