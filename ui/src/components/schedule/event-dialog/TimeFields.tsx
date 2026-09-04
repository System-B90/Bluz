import Box, { BoxProps } from "@mui/material/Box";
import { PickerValue } from "@mui/x-date-pickers/internals";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { EventFieldProps } from "@/components/schedule/event-dialog/utils";

type EventTimeFieldProps = {} & EventFieldProps;

/**
 * Whether an end time may be written back for a given start.
 *
 * An end at or before the start is a negative duration. Accepting one cached
 * that duration and carried the corruption into later start-time edits, where
 * a `Math.max(0, …)` downstream merely hid it (#623).
 *
 * @param startTime The event's current start, if it has one.
 * @param endTime The end the user just picked.
 */
export function isEndTimeValid(
    startTime: Dayjs | null | undefined,
    endTime: Dayjs,
): boolean
{
    return !startTime || endTime.isAfter(startTime);
}

export function EventTimeField({
    event,
    onBlurCallback,
    ...props
}: EventTimeFieldProps & BoxProps)
{
    const startTime = event?.startTime;
    const duration: number = useMemo(
        () => event?.endTime?.diff(event?.startTime) ?? 0,
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
            if (!time) return;
            // The picker's minTime shows the field as invalid; this refuses
            // to write the bad value through (#623).
            if (!isEndTimeValid(startTime, time)) return;

            onBlurCallback({ startTime, endTime: time });
        },
        [ startTime, onBlurCallback ],
    );

    return (
        <Box alignSelf="center" display="flex" gap={ 2 } { ...props }>
            <TimePicker
                label="שעת התחלה"
                onChange={ startTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: "7rem" } }
                value={ event?.startTime ?? dayjs() }
            />
            <TimePicker
                label="שעת סיום"
                minTime={ event?.startTime }
                onChange={ endTimeChange }
                slotProps={ { textField: { fullWidth: true } } }
                sx={ { width: "7rem" } }
                value={ event?.endTime ?? dayjs() }
            />
        </Box>
    );
}
