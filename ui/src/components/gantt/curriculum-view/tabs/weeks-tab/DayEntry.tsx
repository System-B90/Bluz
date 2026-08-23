import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import React, { useCallback, useState } from "react";

import { GanttDayId, GanttDayIndex } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import {
    formatMinutesAsTimeInput,
    parseTimeInputToMinutes,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useCurriculumDay } from "@/components/gantt/state/hooks/UseDay";

type DayEntryProps = {
    dayId: GanttDayId;
};

export const DayEntry = React.memo(({ dayId }: DayEntryProps) => {
    const { enqueueSnackbar } = useSnackbar();
    const day = useCurriculumDay(dayId);
    const { updateDay } = useWeekActions();

    const [localTime, setLocalTime] = useState(() =>
        formatMinutesAsTimeInput(day?.totalWorkingMinutes ?? 0),
    );

    const handleSync = useCallback(() => {
        const parsedMinutes = parseTimeInputToMinutes(localTime);
        if (parsedMinutes === null) {
            setLocalTime(
                formatMinutesAsTimeInput(day?.totalWorkingMinutes ?? 0),
            );
            return;
        }

        if (parsedMinutes !== day?.totalWorkingMinutes) {
            void updateDay(dayId, { totalWorkingMinutes: parsedMinutes }).catch(
                (error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שמירת שעות נכשלה!",
                        error,
                    ),
            );
        }
    }, [
        localTime,
        day?.totalWorkingMinutes,
        updateDay,
        dayId,
        enqueueSnackbar,
    ]);

    const adjustHours = useCallback(
        (amount: number) => {
            const newMinutes = Math.max(
                0,
                Math.min(
                    24 * 60,
                    (day?.totalWorkingMinutes ?? 0) + amount * 60,
                ),
            );
            const formatted = formatMinutesAsTimeInput(newMinutes);
            setLocalTime(formatted); // Update local UI immediately
            void updateDay(dayId, { totalWorkingMinutes: newMinutes }).catch(
                (error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שמירת שעות נכשלה!",
                        error,
                    ),
            );
        },
        [dayId, updateDay, day?.totalWorkingMinutes, enqueueSnackbar],
    );

    // Explicit end of the day's working window. Empty means "derive it" —
    // the day's start time plus its working minutes — which is what the cut
    // balancer falls back to and how days behaved before the field existed.
    const [localEnd, setLocalEnd] = useState(day?.dayEndTime ?? "");

    const handleEndSync = useCallback(() => {
        const trimmed = localEnd.trim();
        const normalized = trimmed === "" ? null : trimmed;
        if (normalized !== null && !/^\d{1,2}:\d{2}$/.test(normalized)) {
            setLocalEnd(day?.dayEndTime ?? "");
            return;
        }
        if (normalized === (day?.dayEndTime ?? null)) return;

        void updateDay(dayId, { dayEndTime: normalized }).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "שמירת שעת סיום נכשלה!",
                error,
            ),
        );
    }, [localEnd, day?.dayEndTime, updateDay, dayId, enqueueSnackbar]);

    const isSaturday = day?.dayIndex === GanttDayIndex.Saturday;
    const isDisabled = isSaturday && (day?.totalWorkingMinutes ?? 0) === 0;

    return (
        <div
            className={`
            group p-3 rounded-lg border border-transparent transition-all duration-150
            hover:border-slate-200 hover:bg-white hover:shadow-sm
            ${isDisabled ? "bg-slate-50 opacity-40" : "bg-slate-100/50"}
        `}
        >
            <div className="flex justify-between items-center">
                <Typography
                    className="font-bold text-slate-600 tracking-tight"
                    variant="caption"
                >
                    {day?.title ?? "יום"}
                </Typography>

                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-1 py-0.5 shadow-inner">
                    <IconButton
                        className="hover:text-red-500 transition-colors"
                        onClick={() => adjustHours(-1)}
                        size="small"
                        sx={{ p: 0.25 }}
                    >
                        <Remove className="text-[1rem]" />
                    </IconButton>

                    <input
                        className="w-12 text-center font-mono text-xs bg-transparent border-none focus:ring-0 focus:outline-none text-slate-800"
                        onBlur={handleSync}
                        onChange={(e) => setLocalTime(e.target.value)}
                        placeholder="00:00"
                        value={localTime}
                    />

                    <IconButton
                        className="hover:text-blue-500 transition-colors"
                        onClick={() => adjustHours(1)}
                        size="small"
                        sx={{ p: 0.25 }}
                    >
                        <Add className="text-[1rem]" />
                    </IconButton>
                </div>
            </div>

            <div className="flex justify-between items-center mt-1">
                <Typography
                    className="text-slate-500 tracking-tight"
                    variant="caption"
                >
                    שעת סיום
                </Typography>
                <input
                    className="w-16 text-center font-mono text-xs bg-white rounded-md border border-slate-200 px-1 py-0.5 focus:ring-0 focus:outline-none text-slate-800"
                    onBlur={handleEndSync}
                    onChange={(e) => setLocalEnd(e.target.value)}
                    placeholder="אוטומטי"
                    title='סוף חלון העבודה של היום. ריק = נגזר משעת ההתחלה + שעות העבודה. הגזירה לעולם לא תציב אירוע אחרי השעה הזו.'
                    value={localEnd}
                />
            </div>

            <TextField
                defaultValue={day?.comment ?? ""}
                fullWidth
                onBlur={(e) => {
                    void updateDay(dayId, { comment: e.target.value });
                }}
                placeholder="הערות..."
                slotProps={{
                    input: {
                        disableUnderline: true,
                        className:
                            "text-[0.7rem] text-slate-500 hover:text-slate-800 transition-colors",
                    },
                }}
                variant="standard"
            />
        </div>
    );
});

DayEntry.displayName = "DayEntry";
