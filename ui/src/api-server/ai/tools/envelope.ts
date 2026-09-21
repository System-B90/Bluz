/**
 * The wrapper every tool result is handed to the model inside.
 *
 * A bare payload tells the model *what* came back but nothing about what to do
 * next, and a bare error string tells it nothing about whether retrying is
 * worth anything. Both are the difference between a model that recovers from a
 * mistyped id and one that loops on it until the iteration cap kills the turn.
 *
 * So every result — success or failure — leaves here as the same envelope:
 * an `ok` flag, the payload, and a short `next` list of instructions written
 * for the model, not for the user. The envelope is also what the panel shows
 * under "details", so the human sees exactly what the model saw.
 */

import { AiTool, AiToolErrorKind } from "@/api-server/ai/tools/types";
import { ClientApiError } from "@/api-shared/errors";
import { AI_MAX_TOOL_RESULT_CHARS, AiToolKind } from "@/api-shared/types/ai";

/** What the model receives as the content of a `tool` message. */
export type AiToolEnvelope = {
    ok: boolean;
    tool: string;
    summary: string;
    /** Present on success. */
    data?: unknown;
    /** Present on failure. */
    error?: { kind: AiToolErrorKind; message: string };
    /** Whether calling again — with corrected arguments — can succeed. */
    retryable?: boolean;
    /** Transport notes the model must know about, e.g. truncation. */
    notes?: Array<string>;
    /** Imperative instructions: what to do with this result. */
    next: Array<string>;
};

/** Guidance attached to every envelope, whatever the tool. */
const BASE_SUCCESS_GUIDANCE = [
    "השתמש רק במזהים ובערכים שחזרו כאן. אל תמציא מזהים.",
];

/**
 * Recovery instructions per failure class. Written as orders rather than
 * descriptions: a model reading "the id does not exist" may or may not re-list;
 * a model reading "call the listing tool again" reliably does.
 */
const RECOVERY: Record<AiToolErrorKind, Array<string>> = {
    [AiToolErrorKind.InvalidArguments]: [
        "הארגומנטים שגויים. תקן אותם לפי הסכמה של הכלי וקרא לו שוב פעם אחת.",
        "אם אינך בטוח מה המשתמש התכוון — שאל אותו עם ask_user במקום לנחש.",
    ],
    [AiToolErrorKind.NotFound]: [
        "המזהה לא קיים. הרץ שוב את כלי הקריאה המתאים כדי לקבל מזהים עדכניים.",
        "אל תקרא לכלי הזה שוב עם אותו מזהה.",
    ],
    [AiToolErrorKind.Rejected]: [
        "הפעולה נדחתה על ידי חוקי המערכת. אל תנסה לעקוף אותה בכלי אחר.",
        "הסבר למשתמש בעברית מה חסם את הפעולה ומה הוא יכול לעשות.",
    ],
    [AiToolErrorKind.Conflict]: [
        "יש התנגשות עם נתונים קיימים. הצג למשתמש את ההתנגשות ובקש החלטה.",
    ],
    [AiToolErrorKind.Unavailable]: [
        "תקלה זמנית בשירות. אל תנסה שוב יותר מפעם אחת; אם היא חוזרת, דווח למשתמש.",
    ],
};

/**
 * Classifies a thrown error into something the model can act on.
 *
 * `ClientApiError` is the app's "the caller was wrong" class, which for a tool
 * call means the *model* was wrong — the one case where retrying with fixed
 * arguments is the right move. Anything else is a dependency fault.
 */
export function classifyToolError(error: unknown): {
    kind: AiToolErrorKind;
    message: string;
} {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ClientApiError) {
        return {
            // Bluz reports a missing document as a plain client error, so the
            // wording is the only signal that separates "wrong id" from
            // "wrong shape" — and they need different recovery advice.
            kind: /לא נמצא|not found/i.test(message)
                ? AiToolErrorKind.NotFound
                : AiToolErrorKind.InvalidArguments,
            message,
        };
    }
    return { kind: AiToolErrorKind.Unavailable, message };
}

/**
 * Keeps one result from eating the context window.
 *
 * The truncation is announced in `notes` rather than done silently: a model
 * that cannot tell a 40-event answer from the first 40 of 900 will confidently
 * report the wrong total.
 */
function capPayload(data: unknown): { data: unknown; notes: Array<string> } {
    const serialized = JSON.stringify(data ?? null);
    if (serialized.length <= AI_MAX_TOOL_RESULT_CHARS) {
        return { data, notes: [] };
    }

    if (Array.isArray(data)) {
        // An array truncates meaningfully: fewer items, each one intact.
        const kept: Array<unknown> = [];
        let size = 0;
        for (const item of data) {
            size += JSON.stringify(item).length + 1;
            if (size > AI_MAX_TOOL_RESULT_CHARS) break;
            kept.push(item);
        }
        return {
            data: kept,
            notes: [
                `התוצאה קוצצה: מוצגים ${kept.length} מתוך ${data.length} פריטים. ` +
                    "צמצם את הטווח או הסינון כדי לראות את השאר.",
            ],
        };
    }

    return {
        data: { truncated: serialized.slice(0, AI_MAX_TOOL_RESULT_CHARS) },
        notes: [
            "התוצאה גדולה מדי והוחזרה חתוכה כמחרוזת. בקש טווח או תת-עץ ממוקד יותר.",
        ],
    };
}

/** Wraps a successful call. */
export function successEnvelope(
    tool: AiTool<any>,
    summary: string,
    data: unknown,
): AiToolEnvelope {
    const capped = capPayload(data);
    return {
        ok: true,
        tool: tool.name,
        summary,
        data: capped.data,
        ...(capped.notes.length ? { notes: capped.notes } : {}),
        next: [
            ...capped.notes.map(() => "ציין למשתמש שהתוצאה חלקית."),
            ...(tool.nextSteps ?? []),
            ...(tool.kind === AiToolKind.Write
                ? ["השינוי בוצע בפועל. דווח עליו למשתמש בקצרה ואל תחזור עליו."]
                : []),
            ...BASE_SUCCESS_GUIDANCE,
        ],
    };
}

/** Wraps a failed call, with the recovery path for its failure class. */
export function errorEnvelope(
    toolName: string,
    error: unknown,
    tool?: AiTool<any>,
): AiToolEnvelope {
    const classified = classifyToolError(error);
    return {
        ok: false,
        tool: toolName,
        summary: classified.message,
        error: classified,
        retryable: classified.kind !== AiToolErrorKind.Rejected,
        next: [
            ...(tool?.recovery ?? []),
            ...RECOVERY[classified.kind],
            "אל תדווח למשתמש שהפעולה הצליחה.",
        ],
    };
}

/** Wraps the "you called something that does not exist" case. */
export function unknownToolEnvelope(name: string): AiToolEnvelope {
    return {
        ok: false,
        tool: name,
        summary: `כלי לא מוכר: ${name}`,
        error: {
            kind: AiToolErrorKind.InvalidArguments,
            message: `כלי לא מוכר: ${name}`,
        },
        retryable: true,
        next: [
            "השתמש רק בכלים שהוגדרו לך. אל תמציא שמות כלים.",
            "אם אין כלי מתאים — אמור למשתמש שהפעולה אינה נתמכת.",
        ],
    };
}

/** Wraps a write the human declined, or a turn the human stopped. */
export function declinedEnvelope(
    toolName: string,
    reason: string,
): AiToolEnvelope {
    return {
        ok: false,
        tool: toolName,
        summary: reason,
        error: { kind: AiToolErrorKind.Rejected, message: reason },
        retryable: false,
        next: [
            "המשתמש דחה את הפעולה. אל תנסה להריץ אותה שוב.",
            "שאל את המשתמש מה הוא כן רוצה שיקרה.",
        ],
    };
}
