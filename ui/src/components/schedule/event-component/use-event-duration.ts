import { Dayjs } from "dayjs";
import moment from "moment";
import { useMemo } from "react";

import { Event } from "@/components/schedule/types/event";

/**
 * Start/end moments of an event plus its length split into whole hours and
 * remaining minutes. Callers format the parts to taste.
 */
export function useEventDuration(event: Event) {
    const start = moment((event.startTime as Dayjs).toDate());
    const end = moment((event.endTime as Dayjs).toDate());

    const durationMinutes = useMemo(
        () => Math.max(0, end.diff(start, "minutes")),
        [start, end],
    );

    return {
        start,
        end,
        durationMinutes,
        hours: Math.floor(durationMinutes / 60),
        minutes: durationMinutes % 60,
        timeRange: `${start.format("HH:mm")} - ${end.format("HH:mm")}`,
    };
}
