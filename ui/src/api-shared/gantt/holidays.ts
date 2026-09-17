import { HebrewCalendar, HDate } from "@hebcal/core";

const NOVI_GOD_COMMENT = "נובי גוד - יום חופש ליוצאי ברית המועצות";

/**
 * Jewish holidays begin at sunset the evening before their civil (Gregorian)
 * date, so a holiday is "on" the day whose night carries it in. @hebcal/core
 * already resolves each holiday to that civil date, so no extra day-shift is
 * needed here - just look the date up.
 */
export function getHolidayComment(date: Date): string | undefined {
    if (date.getUTCMonth() === 11 && date.getUTCDate() === 31) {
        return NOVI_GOD_COMMENT;
    }

    // Callers pass UTC-midnight dates (`YYYY-MM-DDT00:00:00Z`). `new HDate(date)`
    // reads *local* getters, so on a host west of UTC it would resolve the
    // previous civil day. Re-anchor the same civil date at local midnight.
    const hDate = new HDate(
        new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    // `il: true` - Bluz users are in Israel - avoids double-listing holidays
    // that differ only by Diaspora vs. Israel observance (e.g. one-day vs.
    // two-day Pesach).
    const events = HebrewCalendar.getHolidaysOnDate(hDate, true);
    if (!events || events.length === 0) return undefined;

    return events.map((event) => event.render("he-x-NoNikud")).join("\n");
}
