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

const { fetchAiBenchmarkJob, startAiBenchmark } = vi.hoisted(() => ({
    fetchAiBenchmarkJob: vi.fn(),
    startAiBenchmark: vi.fn(),
}));

vi.mock("@/api-client/ai", () => ({ fetchAiBenchmarkJob, startAiBenchmark }));

import { AiSelfTest } from "@/components/settings-dialog/tabs/AiSelfTest";

const report = {
    model: "test-model",
    systemPrompt: "SYS",
    durationMs: 4_000,
    totalTokens: 900,
    passed: 0,
    total: 1,
    checksPassed: 1,
    checksTotal: 2,
    gateHeld: true,
    cases: [
        {
            id: "read-schedule",
            title: 'קריאת הלו"ז',
            prompt: "מה מתוכנן?",
            answer: "יש שלושה אירועים.",
            toolCalls: ["list_events"],
            transcript: [],
            proposals: [],
            durationMs: 1_200,
            passed: false,
            gateHeld: true,
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

const done = { status: "done", startedAt: 1, result: report };

beforeEach(() => {
    vi.clearAllMocks();
    fetchAiBenchmarkJob.mockResolvedValue({ status: "idle" });
});

afterEach(cleanup);

describe("AiSelfTest", () => {
    it("runs on demand and reports a per-check score", async () => {
        startAiBenchmark.mockResolvedValue(done);
        render(<AiSelfTest />);

        await userEvent.click(
            screen.getByRole("button", { name: /בדוק את הסוכן שלי/ }),
        );

        await waitFor(() =>
            expect(screen.getByText("0/1 מקרים עברו")).toBeTruthy(),
        );
        // The cost of testing is shown, not hidden — a run burns real tokens.
        expect(screen.getByText(/900 טוקנים/)).toBeTruthy();
    });

    it("explains what a failed check expected", async () => {
        startAiBenchmark.mockResolvedValue(done);
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
        startAiBenchmark.mockRejectedValue(
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

    it("re-attaches to a finished run when the dialog is reopened", async () => {
        fetchAiBenchmarkJob.mockResolvedValue(done);
        render(<AiSelfTest />);

        await waitFor(() =>
            expect(screen.getByText("0/1 מקרים עברו")).toBeTruthy(),
        );
        expect(startAiBenchmark).not.toHaveBeenCalled();
    });

    it("shows a run still in flight when the dialog is reopened", async () => {
        fetchAiBenchmarkJob.mockResolvedValue({ status: "running", startedAt: 1 });
        render(<AiSelfTest />);

        await waitFor(() => expect(screen.getByText("בודק…")).toBeTruthy());
    });

    it("lists every case live while the run is in flight", async () => {
        fetchAiBenchmarkJob.mockResolvedValue({
            status: "running",
            startedAt: 1,
            cases: [
                { id: "a", title: "מקרה ראשון", prompt: "א", state: "done", toolCalls: ["list_events"], result: report.cases[0] },
                { id: "b", title: "מקרה שני", prompt: "ב", state: "running", toolCalls: ["list_people"] },
                { id: "c", title: "מקרה שלישי", prompt: "ג", state: "pending", toolCalls: [] },
            ],
        });
        render(<AiSelfTest />);

        await waitFor(() => expect(screen.getByText("מקרה שני")).toBeTruthy());
        expect(screen.getByText("מקרה ראשון")).toBeTruthy();
        expect(screen.getByText("מקרה שלישי")).toBeTruthy();
        expect(screen.getByText("1/2")).toBeTruthy();
    });
});
