/**
 * Name: ClosingSaturdayChip.tsx
 * Purpose: Interactive toggle for weekend/Saturday status with high visual clarity.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { EventAvailable, EventBusy } from "@mui/icons-material";
import { Chip, Tooltip } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttWeekId } from "@/api-shared/types/gantt/models";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculumWeek } from "@/components/gantt/state/hooks/UseWeek";

interface ClosingSaturdayChipProps {
  weekId: GanttWeekId;
  weekendDuty: boolean;
}

export function ClosingSaturdayChip({
    weekId,
    weekendDuty,
}: ClosingSaturdayChipProps) {
    const { enqueueSnackbar } = useSnackbar();
    const week = useCurriculumWeek(weekId);
    const { updateWeek } = useWeekActions();

    const clickHandler = useCallback(() => {
        if (!week) {
            return;
        }
        const isClosing = !weekendDuty;

        updateWeek(weekId, { weekendDuty: isClosing }).catch((error: unknown) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת המידע של השבוע נכשלה!",
                error,
            ),
        );
    }, [week, weekId, weekendDuty, updateWeek, enqueueSnackbar]);

    return (
        <Tooltip arrow title={weekendDuty ? "סוגרים שבת" : "יוצאים הביתה"}>
            <Chip
                className={`
                    transition-all duration-300 ease-in-out cursor-pointer font-bold
                    ${
        weekendDuty
            ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md ring-2 ring-amber-200"
            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
        }
                `}
                icon={
                    weekendDuty ? (
                        <EventBusy className="text-white" />
                    ) : (
                        <EventAvailable className="text-slate-500" />
                    )
                }
                label={weekendDuty ? "סוגרים" : "יוצאים"}
                onClick={clickHandler}
                sx={{
                    height: 28,
                    "& .MuiChip-label": { px: 1.5, fontSize: "0.75rem" },
                    "& .MuiChip-icon": { fontSize: "1.1rem", ml: "8px" },
                }}
            />
        </Tooltip>
    );
}
