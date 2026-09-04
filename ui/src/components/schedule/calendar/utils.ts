import moment from "moment";
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

export function getRangeForView(newDate: Date, view: string): DateRange {
    const mDate = moment(newDate);

    let start: Date;
    let end: Date;

    switch (view) {
    case "month":
        start = mDate.clone().startOf("month").toDate();
        end = mDate.clone().endOf("month").toDate();
        break;

    case "week":
        // moment's startOf('week') respects the locale set in moment.locale()
        start = mDate.clone().startOf("week").toDate();
        end = mDate.clone().endOf("week").toDate();
        break;

    case "work_week":
        // The work week grid is Sun–Thu (CustomWorkWeek), so the range must
        // end at Thursday rather than spanning the full Sun–Sat week (#611).
        // Otherwise range-scoped fetches and the ICS export pull in Fri/Sat
        // events that are never shown on screen.
        start = mDate.clone().startOf("week").toDate();
        end = mDate.clone().startOf("week").add(4, "days").endOf("day").toDate();
        break;

    case "day":
        start = mDate.clone().startOf("day").toDate();
        end = mDate.clone().endOf("day").toDate();
        break;

    case "agenda":
        // Agenda usually defaults to a 30-day window from the current date
        start = mDate.clone().startOf("day").toDate();
        end = mDate.clone().add(30, "days").endOf("day").toDate();
        break;

    default:
        start = newDate;
        end = newDate;
    }

    return { start, end };
}
