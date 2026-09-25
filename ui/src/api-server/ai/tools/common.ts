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

/** Default page size for list tools — each result is re-sent every turn. */
export const DEFAULT_PAGE_SIZE = 50;
/** Hard ceiling, whatever the model asks for. */
export const MAX_PAGE_SIZE = 100;

export const NO_PARAMS = {
    type: "object",
    properties: {},
    additionalProperties: false,
} as const;

export const ISO_DATE = {
    type: "string",
    description: "תאריך ושעה בפורמט ISO 8601, למשל 2026-03-01T09:00:00Z",
};

/** Schema fragment every paginated list tool spreads into its properties. */
export const PAGE_PARAMS = {
    offset: {
        type: "integer",
        minimum: 0,
        description: "מאיזה פריט להתחיל (לעמוד הבא — הערך nextOffset מהתשובה הקודמת).",
    },
    limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        description: `כמה פריטים להחזיר. ברירת מחדל ${DEFAULT_PAGE_SIZE}.`,
    },
};

export type PageArgs = { offset?: number; limit?: number };

export type Page<T> = {
    items: Array<T>;
    total: number;
    offset: number;
    /** Present only when more items remain. */
    nextOffset?: number;
};

/**
 * Slices a list to one page, and says so: a model shown 50 of 400 rooms must
 * know there are 400, or it reports the wrong count with confidence.
 */
export function paginate<T>(items: Array<T>, args: PageArgs): Page<T> {
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Math.floor(args.limit ?? DEFAULT_PAGE_SIZE)),
    );
    const slice = items.slice(offset, offset + limit);
    const end = offset + slice.length;
    return {
        items: slice,
        total: items.length,
        offset,
        ...(end < items.length ? { nextOffset: end } : {}),
    };
}

/** Hebrew summary line for a page: "נמצאו 400 חדרים (מוצגים 1–50)". */
export function pageSummary(page: Page<unknown>, noun: string): string {
    if (page.items.length === page.total) return `נמצאו ${page.total} ${noun}`;
    return `נמצאו ${page.total} ${noun} (מוצגים ${page.offset + 1}–${page.offset + page.items.length})`;
}

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
