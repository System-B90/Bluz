import { Box } from "@mui/material";
import { Period } from "@/components/schedule/types/event";
import { TimePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { useEffect } from "react";

interface EventTimeFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function EventTimeField({ period, onPeriodChange }: EventTimeFieldProps)
{
    const duration: number = period?.endTime?.diff(period?.startTime) || 0;
    console.log('EventTimeField duration', period);
    return (
        <Box display="flex" gap={ 2 } alignSelf="center">
            <TimePicker
                label="שעת התחלה"
                value={ period?.startTime || dayjs() }
                onChange={ (time) => onPeriodChange({ startTime: time || dayjs(), endTime: time?.add(duration) }) }
                slotProps={ { textField: { fullWidth: true } } }
            />
            <TimePicker
                label="שעת סיום"
                value={ period?.endTime || dayjs() }
                onChange={ (time) => onPeriodChange({ endTime: time || dayjs() }) }
                slotProps={ { textField: { fullWidth: true } } }
            />
        </Box>
    );
}