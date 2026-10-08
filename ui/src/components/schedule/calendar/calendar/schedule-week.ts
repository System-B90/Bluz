import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";

/**
 * The iteration week a calendar date falls in: week 1 is the Sunday-started
 * week containing the iteration's start date. Null before the iteration
 * starts or when there is no start date.
 */
export function iterationWeekNumber(
    date: Date,
    iterationStart: Date | null | string | undefined,
): null | number
{
    if (!iterationStart) return null;
    const start = dayjs(iterationStart).tz(APP_TIMEZONE).day(0).startOf("day");
    const week = dayjs(date).tz(APP_TIMEZONE).day(0).startOf("day");
    if (!start.isValid() || !week.isValid()) return null;
    // Rounded: a daylight-saving switch makes some weeks an hour short or long.
    const number = Math.round(week.diff(start, "day") / 7) + 1;
    return number >= 1 ? number : null;
}
