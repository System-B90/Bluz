import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { DbEventDocument, Event } from "@/api-shared/types/event";

/**
 * #544/7 — this used to be one function (`eventDateFixup`) that branched on
 * `typeof window` to decide whether startTime/endTime became a native `Date`
 * (server) or a timezone-anchored `Dayjs` (client), while its signature
 * claimed the return type was just `T` — the same type as the input. That
 * was never true: the runtime shape silently depended on *where the code
 * happened to execute*, not on anything the caller passed in, so every
 * client call site had to launder the result back to `Event` with
 * `as unknown as Event` to get a usable type.
 *
 * Split into two explicitly-named functions instead. Every call site already
 * runs unambiguously on one side (api-client/components are always browser
 * context; api-server/app/api routes are always server context), so this is
 * a pure rename with no behavior change — and it removes both the runtime
 * `typeof window` check and the `as unknown as` casts downstream, since the
 * return type now honestly reflects which one ran.
 */

/** Server-side: turns startTime/endTime into native `Date`s. */
export function eventDateFixupToDate<T extends Partial<DbEventDocument | Event>>(
    event: T,
): Omit<T, "endTime" | "startTime"> & Pick<DbEventDocument, "endTime" | "startTime"> {
    // Create a shallow copy so we don't mutate React state or cached objects
    const result: Record<string, unknown> = { ...event };

    if (result.startTime !== undefined) {
        result.startTime = new Date(result.startTime as Date | number | string);
    }
    if (result.endTime !== undefined) {
        result.endTime = new Date(result.endTime as Date | number | string);
    }

    return result as Omit<T, "endTime" | "startTime"> &
        Pick<DbEventDocument, "endTime" | "startTime">;
}

/**
 * Client-side: turns startTime/endTime into a `Dayjs` anchored to the app
 * timezone, so the wall-clock is DST-correct and independent of the
 * viewer's browser timezone (#168).
 */
export function eventDateFixupToDayjs<T extends Partial<DbEventDocument | Event>>(
    event: T,
): Omit<T, "endTime" | "startTime"> & Pick<Event, "endTime" | "startTime"> {
    // Create a shallow copy so we don't mutate React state or cached objects
    const result: Record<string, unknown> = { ...event };

    if (result.startTime !== undefined) {
        result.startTime = dayjs(
            result.startTime as Date | number | string,
        ).tz(APP_TIMEZONE);
    }
    if (result.endTime !== undefined) {
        result.endTime = dayjs(
            result.endTime as Date | number | string,
        ).tz(APP_TIMEZONE);
    }

    return result as Omit<T, "endTime" | "startTime"> &
        Pick<Event, "endTime" | "startTime">;
}
