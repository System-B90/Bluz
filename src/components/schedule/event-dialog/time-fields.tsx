import { Box, BoxProps } from "@mui/material";
import { Period } from "@/components/schedule/types/event";
import { TimePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useEffect } from "react";

interface EventTimeFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function EventTimeField({ period, onPeriodChange, ...props }: EventTimeFieldProps & BoxProps)
{
    const duration: number = (period?.endTime as Dayjs)?.diff(period?.startTime) || 0;
    console.log('EventTimeField duration', period);
    return (
        <Box display="flex" gap={ 2 } alignSelf="center" { ...props }>
            <TimePicker
                label="שעת התחלה"
                value={ (period?.startTime as Dayjs) || dayjs() }
                onChange={ (time) => onPeriodChange({ startTime: time || dayjs(), endTime: time?.add(duration) }) }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
            />
            <TimePicker
                label="שעת סיום"
                value={ (period?.endTime as Dayjs) || dayjs() }
                onChange={ (time) => onPeriodChange({ endTime: time || dayjs() }) }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
            />
        </Box>
    );
}