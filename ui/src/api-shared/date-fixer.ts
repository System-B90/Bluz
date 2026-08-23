import { dayjs } from "@/api-shared/dayjs-setup";

/**
 * #544/7 — split from one `inplaceDateFixup` that branched on `typeof
 * window` to decide whether a field became a native `Date` (server) or a
 * `Dayjs` (client), mirroring the same hazard fixed in api-shared/calendar.ts:
 * the runtime shape depended on *where the code executed*, not on the
 * caller's intent, with nothing in the type signature saying which one ran.
 * Every call site already runs unambiguously on one side (api-client/
 * components are always browser context; app/api routes are always server
 * context), so splitting into two explicitly-named functions is a pure
 * rename with no behavior change.
 */

/** Server-side: mutates `item[fieldName]` into a native `Date` in place. */
export function inplaceDateFixupToDate<T>(
    item: T,
    fieldName: Array<keyof T> | keyof T,
): T {
    if (Array.isArray(fieldName)) {
        fieldName.forEach((k) => inplaceDateFixupToDate(item, k));
    } else {
        const value = item[fieldName];
        if (!value) {
            return item;
        }

        const parsedDate = new Date(value as Date | number | string);
        if (Number.isNaN(parsedDate.getTime())) {
            return item;
        }
        item[fieldName] = parsedDate as T[typeof fieldName];
    }
    return item;
}

/** Client-side: mutates `item[fieldName]` into a `Dayjs` in place. */
export function inplaceDateFixupToDayjs<T>(
    item: T,
    fieldName: Array<keyof T> | keyof T,
): T {
    if (Array.isArray(fieldName)) {
        fieldName.forEach((k) => inplaceDateFixupToDayjs(item, k));
    } else {
        const value = item[fieldName];
        if (!value) {
            return item;
        }

        const parsedDayjs = dayjs(value as Date | number | string);
        if (!parsedDayjs.isValid()) {
            return item;
        }
        item[fieldName] = parsedDayjs as T[typeof fieldName];
    }
    return item;
}
