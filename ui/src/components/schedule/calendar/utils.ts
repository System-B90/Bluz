import { Dayjs } from "dayjs";
import { DateRange } from "react-big-calendar";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";

/** Friday (5) and Saturday (6) — the Israeli weekend, excluded from the work week. */
const WEEKEND_DAY_INDEXES = [5, 6];

/**
 * Whether a date falls on the weekend *in Israel time* (#613).
 *
 * `Date.prototype.getDay()` answers in the browser's zone, so a viewer west of
 * Israel resolves a midnight-boundary column to the previous day and filters
 * the wrong columns out of the work week.
 */
export function isWeekendInAppTimezone(date: Date): boolean {
    return WEEKEND_DAY_INDEXES.includes(dayjs(date).tz(APP_TIMEZONE).day());
}

/**
 * The instants a view spans, for range-scoped fetches and the ICS export.
 *
 * Computed in Israel time rather than the browser's zone (#613): the grid's
 * columns are pinned there, so a range derived locally disagrees with what is
 * on screen for any viewer outside Israel — a Thursday-end computed in UTC is
 * already Friday in Jerusalem, which is exactly what #611 is about.
 */
export function getRangeForView(newDate: Date, view: string): DateRange {
    const date = dayjs(newDate).tz(APP_TIMEZONE);

    let start: Dayjs;
    let end: Dayjs;

    switch (view) {
    case "month":
        start = date.startOf("month");
        end = date.endOf("month");
        break;

    case "week":
        // dayjs weeks start on Sunday, which is the Israeli week.
        start = date.startOf("week");
        end = date.endOf("week");
        break;

    case "work_week":
        // The work week grid is Sun–Thu (CustomWorkWeek), so the range must
        // end at Thursday rather than spanning the full Sun–Sat week (#611).
        // Otherwise range-scoped fetches and the ICS export pull in Fri/Sat
        // events that are never shown on screen.
        start = date.startOf("week");
        end = date.startOf("week").add(4, "days").endOf("day");
        break;

    case "day":
        start = date.startOf("day");
        end = date.endOf("day");
        break;

    case "agenda":
        // Agenda usually defaults to a 30-day window from the current date
        start = date.startOf("day");
        end = date.add(30, "days").endOf("day");
        break;

    default:
        return { start: newDate, end: newDate };
    }

    return { start: start.toDate(), end: end.toDate() };
}
