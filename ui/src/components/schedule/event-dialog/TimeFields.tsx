import { Box, BoxProps } from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers";
import { PickerValue } from "@mui/x-date-pickers/internals";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EventFieldProps } from "@/components/schedule/event-dialog/utils";

interface EventTimeFieldProps extends EventFieldProps { }

;

export function EventTimeField({ event, onBlurCallback, ...props }: EventTimeFieldProps & BoxProps)
{
    const [ startTime, setStartTime ] = useState(event?.startTime ?? dayjs());
    const [ endTime, setEndTime ] = useState(event?.endTime ?? dayjs());

    const duration: number = useMemo(() => (event?.endTime as Dayjs)?.diff(event?.startTime) ?? 0, [ event?.startTime, event?.endTime ]);

    const startTimeChange = useCallback((time: PickerValue) =>
    {
        if (time)
        {
            setStartTime(time);
            setEndTime(time.add(duration));
        }
    }, [ duration ]);

    const endTimeChange = useCallback((time: PickerValue) =>
    {
        if (time)
        {
            setEndTime(time);
        }
    }, [ setEndTime, ]);

    useEffect(() =>
    {
        onBlurCallback({ startTime, endTime });
    }, [ startTime, endTime, onBlurCallback ]);

    return (
        <Box alignSelf="center" display="flex" gap={ 2 } { ...props }>
            <TimePicker
                label="שעת התחלה"
                onChange={ startTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
                value={ (event?.startTime as Dayjs) ?? dayjs() }
            />
            <TimePicker
                label="שעת סיום"
                onChange={ endTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: '7rem' } }
                value={ (event?.endTime as Dayjs) ?? dayjs() }
            />
        </Box>
    );
}
