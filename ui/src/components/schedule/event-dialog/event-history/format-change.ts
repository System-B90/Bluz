import dayjs from "dayjs";

import { EventFieldChange } from "@/api-shared/types/event-history";

/**
 * Renders a logged field value for humans. The log stores raw wire values
 * (epoch ms for dates, id arrays for people/rooms/courses), so the panel needs
 * name lookups injected — kept as a plain callback map so this stays pure and
 * testable without React providers.
 */

export type ChangeValueLookups = {
    courseName: (id: string) => string | undefined;
    instructorName: (id: number) => string | undefined;
    roomName: (id: string) => string | undefined;
};

/** Fields whose values are epoch milliseconds (normalized by the diff). */
const TIME_FIELDS = new Set(["endTime", "startTime"]);

/** Fields holding id arrays, each with its own resolver. */
const ID_LIST_FIELDS = new Set(["courses", "instructors", "lecturers", "rooms"]);

const EMPTY = "—";

function resolveId(
    field: string,
    id: unknown,
    lookups: ChangeValueLookups,
): string {
    if (field === "instructors" || field === "lecturers") {
        if (typeof id === "number") {
            return lookups.instructorName(id) ?? `#${id}`;
        }
        return String(id); // outsider marker / free-text lecturer
    }
    if (field === "courses") {
        return lookups.courseName(String(id)) ?? String(id);
    }
    // Rooms are stored as resolvable objects; fall back to their raw id.
    const roomId =
        typeof id === "object" && id !== null && "id" in id
            ? String((id as { id: unknown }).id)
            : String(id);
    return lookups.roomName(roomId) ?? roomId;
}

/**
 * Format one side of a change for display.
 * @param field The field the value belongs to (drives the formatting).
 * @param value The raw logged value.
 * @param lookups Name resolvers for id-shaped values.
 * @returns A human-readable string; an em dash for empty/absent values.
 * @example
 * ```typescript
 * formatChangeValue("startTime", 1704614400000, lookups); // "07/01/2024 08:00"
 * ```
 */
export function formatChangeValue(
    field: string,
    value: unknown,
    lookups: ChangeValueLookups,
    // Omits the date and shows only the time — the date side of the row is
    // redundant when both sides of the change land on the same calendar day.
    timeOnly = false,
): string {
    if (value === null || value === undefined || value === "") return EMPTY;

    if (TIME_FIELDS.has(field) && typeof value === "number") {
        return dayjs(value).format(timeOnly ? "HH:mm" : "DD/MM/YYYY HH:mm");
    }

    if (typeof value === "boolean") return value ? "כן" : "לא";

    if (Array.isArray(value)) {
        if (value.length === 0) return EMPTY;
        if (ID_LIST_FIELDS.has(field)) {
            return value.map((id) => resolveId(field, id, lookups)).join(", ");
        }
        return value.map((item) => String(item)).join(", ");
    }

    if (typeof value === "object") return JSON.stringify(value);

    return String(value as number | string);
}

/** Both sides of a change, ready to render. */
export type FormattedChange = {
    field: string;
    from: string;
    to: string;
};

/**
 * Format a whole change row.
 * @param change The logged field change.
 * @param lookups Name resolvers for id-shaped values.
 */
export function formatChange(
    change: EventFieldChange,
    lookups: ChangeValueLookups,
): FormattedChange {
    const sameDay =
        TIME_FIELDS.has(change.field) &&
        typeof change.from === "number" &&
        typeof change.to === "number" &&
        dayjs(change.from).isSame(change.to, "day");

    return {
        field: change.field,
        from: formatChangeValue(change.field, change.from, lookups, sameDay),
        to: formatChangeValue(change.field, change.to, lookups, sameDay),
    };
}

/**
 * Hebrew counts one, two and many differently, so a naive `לפני ${n} דקות`
 * reads wrong for the two most common cases. Each unit carries its singular,
 * dual and plural form.
 */
const UNIT_FORMS = {
    day: { dual: "יומיים", plural: "ימים", singular: "יום" },
    hour: { dual: "שעתיים", plural: "שעות", singular: "שעה" },
    minute: { dual: "שתי דקות", plural: "דקות", singular: "דקה" },
} as const;

function agoIn(count: number, unit: keyof typeof UNIT_FORMS): string {
    const forms = UNIT_FORMS[unit];
    if (count === 1) return `לפני ${forms.singular}`;
    if (count === 2) return `לפני ${forms.dual}`;
    return `לפני ${count} ${forms.plural}`;
}

/**
 * Relative wording for a timestamp ("לפני 5 דקות"), with day granularity past
 * a week. Kept local rather than pulling in dayjs' relativeTime plugin and a
 * Hebrew locale bundle for one label.
 * @param iso ISO timestamp of the change.
 * @returns A Hebrew phrase, or an absolute date once older than a week.
 * @example
 * ```typescript
 * relativeTime(oneMinuteAgo); // "לפני דקה"
 * ```
 */
export function relativeTime(iso: string): string {
    const then = dayjs(iso);
    const minutes = dayjs().diff(then, "minute");

    if (minutes < 1) return "הרגע";
    if (minutes < 60) return agoIn(minutes, "minute");

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return agoIn(hours, "hour");

    const days = Math.floor(hours / 24);
    if (days < 7) return agoIn(days, "day");

    return then.format("DD/MM/YYYY");
}
