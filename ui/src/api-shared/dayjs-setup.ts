import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

// Central dayjs plugin initialization (#168). Extending here (and importing this
// module early, e.g. from api-shared/calendar) guarantees UTC + timezone support
// is loaded before any date math runs, so Israel DST transitions can't silently
// shift dragged/displayed events by an hour. `extend` is idempotent, so importing
// this module from multiple entry points is safe.
// customParseFormat is what makes `dayjs(str, "HH:mm")` honour the format
// argument (#607). Without it dayjs falls back to `new Date(str)`, and a plain
// "07:00" parses to Invalid Date, which silently poisons the calendar bounds.
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * The single wall-clock timezone the scheduling app operates in. All calendar
 * events are interpreted and displayed in Israel time regardless of the
 * viewer's browser timezone, and the timezone plugin makes this DST-correct
 * across the spring/autumn transitions.
 */
export const APP_TIMEZONE = "Asia/Jerusalem";

export { dayjs };
