import dayjs from "dayjs";

import { Event } from "@/components/schedule/types/event";

export function deepCopyEvent(event: Event): Event {
    const cpy = {
        ...event,
    };

    cpy.courses = [...event.courses];
    cpy.rooms = [...event.rooms];
    cpy.instructors = [...event.instructors];
    cpy.tags = [...event.tags];

    // `lecturers` is optional and absent on event types that have no lecturers.
    // Materializing it as `[]` made the copy differ from its own source under
    // `areValuesEqual` — either an extra key or `[]` against `undefined` — so
    // the offline snapshot reported every untouched event as locally modified
    // and the push dialog opened with nothing to push (#386).
    //
    // The check is `Array.isArray` rather than a comparison against `undefined`:
    // stored events can carry an explicit `lecturers: null`, and spreading that
    // throws "not iterable" and takes the whole page down through the error
    // boundary. Anything that is not an array is left exactly as the spread
    // copied it, which is also what keeps the copy comparing equal to its source.
    if (Array.isArray(event.lecturers)) {
        cpy.lecturers = [...event.lecturers];
    }

    return cpy;
}

function arraysEqual(
    a: Array<any> | undefined,
    b: Array<any> | undefined,
): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (!areValuesEqual(a[i], b[i])) return false;
    }

    return true;
}

export function areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) {
        return a === b;
    }

    // Handle Date / Dayjs / ISO string-based dates.
    // Only recognise strings that look like ISO 8601 to avoid treating plain
    // strings (ids, names, "5") as dates via dayjs's permissive parser.
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/;
    const isDateA =
        a instanceof Date ||
        dayjs.isDayjs(a) ||
        (typeof a === "string" && ISO_DATE_RE.test(a));
    const isDateB =
        b instanceof Date ||
        dayjs.isDayjs(b) ||
        (typeof b === "string" && ISO_DATE_RE.test(b));
    if (isDateA && isDateB) {
        return dayjs(a).valueOf() === dayjs(b).valueOf();
    }

    // Handle arrays deeply
    if (Array.isArray(a) && Array.isArray(b)) {
        return arraysEqual(a, b);
    }

    // Handle objects (including extra dynamic properties and excluding database _id)
    if (typeof a === "object" && typeof b === "object") {
        const keysA = Object.keys(a).filter((k) => k !== "_id");
        const keysB = Object.keys(b).filter((k) => k !== "_id");

        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (!keysB.includes(key)) return false;
            if (!areValuesEqual(a[key], b[key])) return false;
        }

        return true;
    }

    return String(a) === String(b);
}

export function areEventsEqual(event1: Event, event2: Event): boolean {
    return areValuesEqual(event1, event2);
}
