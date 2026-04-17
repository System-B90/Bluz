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
import { CurriculumWeekId } from "@/api-shared/types/gant/curriculum";
import { useWeekActions } from "@/components/gant/state/hooks/gant-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gant/state/hooks/UseCurriculumWeek";

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
    const { updateWeek } = useWeekActions();

    const clickHandler = useCallback(() =>
    {
        if (!week) { return; }
        const isClosing = !closingSaturday;
        
        updateWeek(weekId, { closingSaturday: isClosing })
            .catch((error: unknown) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המידע של השבוע נכשלה!', error));
    }, [ week, weekId, closingSaturday, updateWeek, enqueueSnackbar ]);

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
