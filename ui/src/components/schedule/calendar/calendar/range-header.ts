import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { formatRange, isolateRtl } from "@/components/base/bidi";

/**
 * The calendar's week/day range header, e.g. `05 - 11 בספטמבר 2026`.
 *
 * Kept out of CalendarView so the formatting -- in particular the bidi
 * isolation, which regresses silently and is invisible in code review -- can be
 * tested without mounting the calendar.
 */
export function dayRangeHeaderFormat({
    start,
    end,
}: {
    start: Date;
    end: Date;
}): string
{
    const s = dayjs(start).tz(APP_TIMEZONE).locale("he");
    const e = dayjs(end).tz(APP_TIMEZONE).locale("he");
    if (s.year() !== e.year())
    {
        // A week across New Year needs both years, or the start reads as
        // belonging to the end's year (#653).
        return isolateRtl(
            isolateRtl(`${s.format("DD")} ב${s.format("MMMM")} ${s.format("YYYY")}`) + ' - ' +
            isolateRtl(`${e.format("DD")} ב${e.format("MMMM")} ${e.format("YYYY")}`),
        );
    }
    if (s.month() === e.month())
    {
        // Only the two day numbers form the numeric range; the month and year
        // stay in the surrounding RTL run.
        return `${formatRange(s.format("DD"), e.format("DD"))} ב${s.format("MMMM")} ${s.format("YYYY")}`;
    }
    // Each side carries its own month name, so isolating either side alone
    // would not help — the whole range is one LTR run here.

    return `${isolateRtl(
        isolateRtl(`${s.format("DD")} ב${s.format("MMMM")}`) + ' - ' +
        isolateRtl(`${e.format("DD")} ב${e.format("MMMM")}`),
    )} ${e.format("YYYY")}`;
}
