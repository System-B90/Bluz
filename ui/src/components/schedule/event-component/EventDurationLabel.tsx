import { Chip, ChipProps, Tooltip } from "@mui/material";
import { Dayjs } from "dayjs";
import moment from "moment";
import { useMemo } from "react";

import { Event } from "@/components/schedule/types/event";

export function EventDurationLabel({ event, sx, size, ...props }: { event: Event; } & ChipProps)
{
    const start = moment((event.startTime as Dayjs).toDate());
    const end = moment((event.endTime as Dayjs).toDate());

    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [ start, end ]
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    const durationLabel =
        hours && minutes ? `${hours} ש׳ ${minutes} ד׳`
            : hours ? `${hours} ש׳`
                : `${minutes} ד׳`;

    return (
        <Tooltip title={ `${start.format('HH:mm')} - ${end.format('HH:mm')}` } >
            <Chip label={ durationLabel } size={ size ?? "small" } sx={ { ...sx, color: 'inherit' } } { ...props } />
        </Tooltip>
    );
}
