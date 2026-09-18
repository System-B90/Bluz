import { describe, expect, it } from "vitest";

/**
 * The tool-result envelope.
 *
 * Its whole reason to exist is that a bare payload leaves the model to guess
 * what to do next, and a bare error leaves it to guess whether retrying is
 * worth anything — which is how a mistyped id turns into eight identical tool
 * calls and a turn killed by the iteration cap.
 */

import {
    classifyToolError,
    declinedEnvelope,
    errorEnvelope,
    successEnvelope,
    unknownToolEnvelope,
} from "@/api-server/ai/tools/envelope";
import { AiTool, AiToolErrorKind } from "@/api-server/ai/tools/types";
import { ClientApiError } from "@/api-shared/errors";
import {
    AI_MAX_TOOL_RESULT_CHARS,
    AiToolDanger,
    AiToolKind,
} from "@/api-shared/types/ai";

const readTool: AiTool<any> = {
    name: "list_events",
    title: 'אירועי הלו"ז',
    description: "read",
    kind: AiToolKind.Read,
    danger: AiToolDanger.Safe,
    parameters: {},
    nextSteps: ["ודא מול הרשימה לפני שינוי."],
    execute: async () => ({ data: null, summary: "" }),
};

const writeTool: AiTool<any> = {
    ...readTool,
    name: "delete_event",
    title: "מחיקת אירוע",
    kind: AiToolKind.Write,
    danger: AiToolDanger.Destructive,
    nextSteps: undefined,
};

describe("successEnvelope", () => {
    it("carries the payload plus the tool's own next steps", () => {
        const envelope = successEnvelope(readTool, "נמצאו 3", [{ id: "e1" }]);

        expect(envelope).toMatchObject({
            ok: true,
            tool: "list_events",
            summary: "נמצאו 3",
            data: [{ id: "e1" }],
        });
        expect(envelope.next).toContain("ודא מול הרשימה לפני שינוי.");
        expect(envelope.next).toContain(
            "השתמש רק במזהים ובערכים שחזרו כאן. אל תמציא מזהים.",
        );
    });

    it("tells the model a write already happened, so it does not repeat it", () => {
        const envelope = successEnvelope(writeTool, "נמחק", { id: "e1" });
        expect(envelope.next.join(" ")).toContain("השינוי בוצע בפועל");
    });

    it("truncates an oversized array and says how much it kept", () => {
        // A tool that hands back a 200KB tree spends the whole context window
        // on one call — and bills it again every later turn.
        const huge = Array.from({ length: 5_000 }, (_, index) => ({
            id: `event-${index}`,
            name: "אירוע ארוך מאוד עם שם שתופס מקום",
        }));

        const envelope = successEnvelope(readTool, "הרבה", huge);
        const kept = envelope.data as Array<unknown>;

        expect(kept.length).toBeLessThan(huge.length);
        expect(JSON.stringify(envelope.data).length).toBeLessThanOrEqual(
            AI_MAX_TOOL_RESULT_CHARS + 200,
        );
        // Silent truncation would have the model confidently report the wrong
        // total, which is worse than returning less.
        expect(envelope.notes?.[0]).toContain(String(huge.length));
    });

    it("leaves a payload under the cap untouched", () => {
        const envelope = successEnvelope(readTool, "קטן", { a: 1 });
        expect(envelope.data).toEqual({ a: 1 });
        expect(envelope.notes).toBeUndefined();
    });
});

describe("classifyToolError", () => {
    it("reads a missing record as not-found, not as bad arguments", () => {
        // They need opposite recovery: one means re-list, the other means fix
        // the arguments and retry.
        expect(classifyToolError(new ClientApiError("אירוע e1 לא נמצא"))).toMatchObject(
            { kind: AiToolErrorKind.NotFound },
        );
    });

    it("reads any other client error as bad arguments", () => {
        expect(
            classifyToolError(new ClientApiError("ערך תאריך לא תקין")),
        ).toMatchObject({ kind: AiToolErrorKind.InvalidArguments });
    });

    it("reads an unexpected failure as a dependency fault", () => {
        expect(classifyToolError(new Error("ECONNREFUSED"))).toMatchObject({
            kind: AiToolErrorKind.Unavailable,
        });
    });
});

describe("errorEnvelope", () => {
    it("tells a model that used a stale id to re-list rather than retry", () => {
        const envelope = errorEnvelope(
            "delete_event",
            new ClientApiError("אירוע e1 לא נמצא"),
            writeTool,
        );

        expect(envelope.ok).toBe(false);
        expect(envelope.retryable).toBe(true);
        expect(envelope.next.join(" ")).toContain("אל תקרא לכלי הזה שוב עם אותו מזהה");
    });

    it("puts the tool's own recovery advice first", () => {
        const envelope = errorEnvelope(
            "cut_curriculum",
            new Error("boom"),
            { ...writeTool, recovery: ["אל תנסה שוב אחרי כישלון גזירה."] },
        );
        expect(envelope.next[0]).toBe("אל תנסה שוב אחרי כישלון גזירה.");
    });
});

describe("unknownToolEnvelope and declinedEnvelope", () => {
    it("tells the model invented tool names are not available", () => {
        const envelope = unknownToolEnvelope("delete_everything");
        expect(envelope.retryable).toBe(true);
        expect(envelope.next.join(" ")).toContain("אל תמציא שמות כלים");
    });

    it("marks a refusal as final so the model stops asking", () => {
        const envelope = declinedEnvelope("delete_event", "המשתמש לא אישר");
        expect(envelope.retryable).toBe(false);
        expect(envelope.error?.kind).toBe(AiToolErrorKind.Rejected);
    });
});
