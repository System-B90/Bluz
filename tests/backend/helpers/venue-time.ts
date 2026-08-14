import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";

/**
 * Venue-timezone helpers for tests that assert on scheduling times (#415).
 *
 * The cut planner anchors every occurrence to `APP_TIMEZONE` rather than to the
 * process timezone, so fixtures and assertions must do the same. Building an
 * expectation with `new Date("...T08:00:00")` — or reading one back with
 * `.getHours()` — silently re-introduces the machine timezone, which is exactly
 * the coupling the planner was fixed to remove: those tests pass on an Israeli
 * workstation and fail on a UTC CI runner.
 */

/** A venue wall clock (`YYYY-MM-DDTHH:mm`) as a `Date`. */
export function venueDate(wallClock: string): Date {
    return dayjs.tz(`${wallClock}:00`, APP_TIMEZONE).toDate();
}

/** A venue wall clock (`YYYY-MM-DDTHH:mm`) as an ISO instant. */
export function venueTime(wallClock: string): string {
    return venueDate(wallClock).toISOString();
}

/** Reads an instant back as `HH:mm` on the venue clock. */
export function venueHhmm(date: Date): string {
    return dayjs(date).tz(APP_TIMEZONE).format("HH:mm");
}

/** Reads an instant back as its hour on the venue clock. */
export function venueHour(date: Date): number {
    return dayjs(date).tz(APP_TIMEZONE).hour();
}

/** Reads an instant back as its minute on the venue clock. */
export function venueMinute(date: Date): number {
    return dayjs(date).tz(APP_TIMEZONE).minute();
}
