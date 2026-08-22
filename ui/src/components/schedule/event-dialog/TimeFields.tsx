import Box, { BoxProps } from "@mui/material/Box";
import { PickerValue } from "@mui/x-date-pickers/internals";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { EventFieldProps } from "@/components/schedule/event-dialog/utils";

type EventTimeFieldProps = {} & EventFieldProps;

export function EventTimeField({
    event,
    onBlurCallback,
    ...props
}: EventTimeFieldProps & BoxProps)
{
    const duration: number = useMemo(
        () => (event?.endTime as Dayjs)?.diff(event?.startTime) ?? 0,
        [ event?.startTime, event?.endTime ],
    );

    // The pickers are controlled by `event`, not local state — write straight
    // back through onBlurCallback on change instead of mirroring into state
    // and syncing via an effect, which fired an extra parent write on every
    // mount (dialog open) even when nothing changed.
    const startTimeChange = useCallback(
        (time: PickerValue) =>
        {
            if (time)
            {
                onBlurCallback({ startTime: time, endTime: time.add(duration) });
            }
        },
        [ duration, onBlurCallback ],
    );

    const endTimeChange = useCallback(
        (time: PickerValue) =>
        {
            if (time)
            {
                onBlurCallback({ startTime: event?.startTime as Dayjs, endTime: time });
            }
        },
        [ event?.startTime, onBlurCallback ],
    );

    return (
        <Box alignSelf="center" display="flex" gap={ 2 } { ...props }>
            <TimePicker
                label="שעת התחלה"
                onChange={ startTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: "7rem" } }
                value={ (event?.startTime as Dayjs) ?? dayjs() }
            />
            <TimePicker
                label="שעת סיום"
                onChange={ endTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: "7rem" } }
                value={ (event?.endTime as Dayjs) ?? dayjs() }
            />
        </Box>
    );
}
