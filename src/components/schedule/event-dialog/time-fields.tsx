import { Box, BoxProps } from "@mui/material";
import { Event } from "@/components/schedule/types/event";
import { TimePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useEffect, useMemo } from "react";

interface EventTimeFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
}

export default function EventTimeField({ event, onEventChange, ...props }: EventTimeFieldProps & BoxProps)
{
    const duration: number = useMemo(() => (event?.endTime as Dayjs)?.diff(event?.startTime) || 0, [ event?.startTime, event?.endTime ]);

    return (
        <Box display="flex" gap={ 2 } alignSelf="center" { ...props }>
            <TimePicker
                label="שעת התחלה"
                value={ (event?.startTime as Dayjs) || dayjs() }
                onChange={ (time) => onEventChange({ startTime: time || dayjs(), endTime: time?.add(duration) }) }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
            />
            <TimePicker
                label="שעת סיום"
                value={ (event?.endTime as Dayjs) || dayjs() }
                onChange={ (time) => onEventChange({ endTime: time || dayjs() }) }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
            />
        </Box>
    );
}