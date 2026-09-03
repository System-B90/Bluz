import { Dayjs } from "dayjs";
import moment from "moment";
import { useMemo } from "react";

import { formatRange } from "@/components/base/bidi";
import { Event } from "@/components/schedule/types/event";

/**
 * The tooltip's `HH:mm - HH:mm` range, isolated so RTL layout cannot reverse
 * the two sides. Split out from the hook so the isolation is unit-testable.
 */
export function eventTimeRange(start: string, end: string): string {
    return formatRange(start, end);
}

/**
 * Start/end moments of an event plus its length split into whole hours and
 * remaining minutes. Callers format the parts to taste.
 */
export function useEventDuration(event: Event) {
    const startTime = event.startTime as Dayjs;
    const endTime = event.endTime as Dayjs;
    const startTimeMs = startTime.valueOf();
    const endTimeMs = endTime.valueOf();

    // moment() built fresh every render, so memoizing durationMinutes on
    // start/end (also rebuilt every render) never actually hit the cache.
    // Memoize on the underlying primitive timestamps instead.
    const start = useMemo(() => moment(startTimeMs), [startTimeMs]);
    const end = useMemo(() => moment(endTimeMs), [endTimeMs]);

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
        timeRange: eventTimeRange(start.format("HH:mm"), end.format("HH:mm")),
    };
}
