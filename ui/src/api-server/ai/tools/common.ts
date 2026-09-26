/**
 * Helpers shared by every tool module: argument parsing, schema fragments,
 * approval-card formatting and list pagination.
 *
 * Kept apart from any one domain so a calendar tool and a gantt tool that
 * both take a date, or both page a list, do it the same way.
 */

import { AiToolContext } from "@/api-server/ai/tools/types";
import { EventWriteOrigin } from "@/api-server/db-event-history";
import { ClientApiError } from "@/api-shared/errors";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { RoomSource } from "@/api-shared/types/room";

export const NO_PARAMS = {
    type: "object",
    properties: {},
    additionalProperties: false,
} as const;

export const ISO_DATE = {
    type: "string",
    description: "תאריך ושעה בפורמט ISO 8601, למשל 2026-03-01T09:00:00Z",
};

/**
 * `RoomSource` is a numeric enum, so `Object.values` would also advertise its
 * reverse-mapped names ("Custom", "Hive") — values the store never matches.
 */
export const ROOM_SOURCE_PARAM = {
    type: "integer",
    enum: [RoomSource.Custom, RoomSource.Hive],
    description: `מקור החדר: ${RoomSource.Custom} — חדר שהוגדר בבלוז, ${RoomSource.Hive} — חדר הייב`,
};

export {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    PAGE_PARAMS,
    type Page,
    type PageArgs,
    pageSummary,
    paginate,
} from "@/api-server/ai/tools/page";

/**
 * Marks every assistant write in the event history, so a curious operator can
 * always tell an AI edit from a human one after the fact.
 */
export function aiOrigin(context: AiToolContext): EventWriteOrigin {
    return {
        initiator: EventChangeInitiator.AiAssistant,
        actor: context.actor,
    };
}

/**
 * Escapes text before it reaches Mongo's `$regex`. The model relays whatever
 * the user typed, so an unescaped value both widens the search silently (`.`,
 * `|`) and exposes the server to catastrophic backtracking (`(a+)+b`).
 */
export function escapeRegex(value: string): string {
    return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

/** Rejects a date the model invented in the wrong format. */
export function parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ClientApiError(`ערך תאריך לא תקין בשדה ${field}: ${value}`);
    }
    return date;
}

/** Rejects a missing or blank required string the model left out. */
export function requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
        throw new ClientApiError(`השדה ${field} חובה`);
    }
    return value.trim();
}

/**
 * Renders a range the way the approval card should show it.
 *
 * The card is the last thing a human reads before agreeing to a change, and
 * `2026-03-01T09:00:00Z` is not something anyone verifies correctly at a
 * glance. An unparsable value falls through to the raw string rather than
 * throwing: this runs inside `describe`, which must never break the gate it
 * is describing.
 */
export function formatRange(start: string, end: string): string {
    const from = new Date(start);
    const to = new Date(end);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return `${start} — ${end}`;
    }

    const day = from.toLocaleDateString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "numeric",
    });
    const time = (date: Date) =>
        date.toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
        });
    return `${day}, ${time(from)}–${time(to)}`;
}

/**
 * Names the fields a partial update will write, in Hebrew. A human approving
 * "עדכון X" has no way to tell a rename from a reschedule otherwise.
 */
export function changedFieldsImpact(
    args: Record<string, unknown>,
    labels: Record<string, string>,
): Array<string> {
    const changes = Object.keys(args)
        .filter((key) => key in labels && args[key] !== undefined)
        .map((key) => labels[key]);
    return changes.length ? changes : ["לא צוינו שדות לשינוי."];
}

/** Copies only the keys present in `args` — a partial patch, never a reset. */
export function pickDefined<T extends Record<string, unknown>, K extends keyof T>(
    args: T,
    keys: ReadonlyArray<K>,
): Partial<Pick<T, K>> {
    const result: Partial<Pick<T, K>> = {};
    for (const key of keys) {
        if (args[key] !== undefined) result[key] = args[key];
    }
    return result;
}
