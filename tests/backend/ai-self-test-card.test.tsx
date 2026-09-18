// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The self-test card in Personal Settings (#704).
 *
 * What it must never do is imply a verdict the run cannot support: the score
 * is per check, and a failed check has to say what was expected, or the user
 * learns nothing actionable about their model.
 */

const { runAiBenchmark } = vi.hoisted(() => ({ runAiBenchmark: vi.fn() }));

vi.mock("@/api-client/ai", () => ({ runAiBenchmark }));

import { AiSelfTest } from "@/components/settings-dialog/tabs/AiSelfTest";

const report = {
    model: "test-model",
    durationMs: 4_000,
    totalTokens: 900,
    passed: 1,
    total: 2,
    cases: [
        {
            id: "read-schedule",
            title: 'קריאת הלו"ז',
            prompt: "מה מתוכנן?",
            answer: "יש שלושה אירועים.",
            toolCalls: ["list_events"],
            durationMs: 1_200,
            checks: [
                { label: "השתמש בכלי קריאת האירועים", passed: true },
                {
                    label: "ציין אירוע אמיתי מהנתונים",
                    passed: false,
                    detail: "התשובה לא הזכירה אף אירוע מנתוני הבדיקה.",
                },
            ],
        },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

describe("AiSelfTest", () => {
    it("runs on demand and reports a per-check score", async () => {
        runAiBenchmark.mockResolvedValue(report);
        render(<AiSelfTest />);

        await userEvent.click(
            screen.getByRole("button", { name: /בדוק את הסוכן שלי/ }),
        );

        await waitFor(() =>
            expect(screen.getByText("1/2 בדיקות עברו")).toBeTruthy(),
        );
        // The cost of testing is shown, not hidden — a run burns real tokens.
        expect(screen.getByText(/900 טוקנים/)).toBeTruthy();
    });

    it("explains what a failed check expected", async () => {
        runAiBenchmark.mockResolvedValue(report);
        render(<AiSelfTest />);

        await userEvent.click(
            screen.getByRole("button", { name: /בדוק את הסוכן שלי/ }),
        );
        await waitFor(() => expect(screen.getByText('קריאת הלו"ז')).toBeTruthy());

        await userEvent.click(screen.getByText('קריאת הלו"ז'));
        expect(
            screen.getByText("התשובה לא הזכירה אף אירוע מנתוני הבדיקה."),
        ).toBeTruthy();
        expect(screen.getByText(/list_events/)).toBeTruthy();
    });

    it("shows a throttled run as a readable message, not a dead button", async () => {
        runAiBenchmark.mockRejectedValue(
            new Error("בדיקת הסוכן זמינה פעם בשעה. נסה שוב בעוד 42 דקות."),
        );
        render(<AiSelfTest />);

        await userEvent.click(
            screen.getByRole("button", { name: /בדוק את הסוכן שלי/ }),
        );

        await waitFor(() =>
            expect(screen.getByText(/פעם בשעה/)).toBeTruthy(),
        );
        expect(
            screen.getByRole("button", { name: /בדוק את הסוכן שלי/ }),
        ).toBeTruthy();
    });
});
