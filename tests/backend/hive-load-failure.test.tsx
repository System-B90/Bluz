// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hive lookup failures (#823): one merged toast in plain Hebrew, saying what
 * is lost, with a retry action — no `HiveClientError: Not Found` up front.
 */

const { snack } = vi.hoisted(() => ({
    snack: { enqueue: vi.fn(), close: vi.fn() },
}));
vi.mock("notistack", () => ({
    enqueueSnackbar: snack.enqueue,
    closeSnackbar: snack.close,
}));

import { UserNotLoggedInError } from "@/api-shared/errors";
import {
    hiveFailureMessage,
    reportHiveLoadFailure,
} from "@/components/base/hive-load-failure";

class HiveClientError extends Error {
    name = "HiveClientError";
}

beforeEach(() => {
    vi.useFakeTimers();
    snack.enqueue.mockClear();
    snack.close.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("hiveFailureMessage", () => {
    it("names what the user loses, without technical text", () => {
        const message = hiveFailureMessage([ "subjects", "users" ]);
        expect(message).toBe("נתונים מהייב לא זמינים כרגע: שמות מקצועות ושמות משתמשים ומדריכים לא יוצגו.");
        expect(message).not.toMatch(/Error|Not Found/);
    });
});

describe("reportHiveLoadFailure (#823)", () => {
    it("merges near-simultaneous failures into one toast", () => {
        reportHiveLoadFailure("subjects", new HiveClientError("Not Found"), vi.fn());
        reportHiveLoadFailure("users", new HiveClientError("Not Found"), vi.fn());
        vi.advanceTimersByTime(1_000);

        expect(snack.enqueue).toHaveBeenCalledTimes(1);
        const [ body, options ] = snack.enqueue.mock.calls[ 0 ];
        expect(body.props.message).toContain("שמות מקצועות");
        expect(body.props.message).toContain("שמות משתמשים");
        expect(body.props.details).toEqual([ "HiveClientError: Not Found", "HiveClientError: Not Found" ]);
        expect(options.anchorOrigin).toEqual({ horizontal: "center", vertical: "bottom" });
    });

    it("retries every failed lookup from the toast's action", () => {
        const retrySubjects = vi.fn();
        const retryUsers = vi.fn();
        reportHiveLoadFailure("subjects", new Error("x"), retrySubjects);
        reportHiveLoadFailure("users", new Error("x"), retryUsers);
        vi.advanceTimersByTime(1_000);

        const action = snack.enqueue.mock.calls[ 0 ][ 1 ].action("k");
        const retryButton = action.props.children[ 0 ];
        expect(retryButton.props.children).toBe("נסה שוב");
        retryButton.props.onClick();
        expect(retrySubjects).toHaveBeenCalledTimes(1);
        expect(retryUsers).toHaveBeenCalledTimes(1);
    });

    it("stays quiet for a signed-out session", () => {
        reportHiveLoadFailure("subjects", new UserNotLoggedInError(), vi.fn());
        vi.advanceTimersByTime(1_000);
        expect(snack.enqueue).not.toHaveBeenCalled();
    });
});
