import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSystemPrompt } from "@/api-server/ai/system-prompt";
import { AiToolContext } from "@/api-server/ai/tools/types";

/**
 * Unit tests for the assistant's standing instructions. The prompt is rebuilt
 * server-side every turn so a client replaying a doctored transcript cannot
 * rewrite the rules — these tests pin the assembled sections.
 */

const context = (overrides: Partial<AiToolContext> = {}): AiToolContext =>
    ({
        actor: { id: "u1", displayName: "מיכאל" },
        iterationId: "2026b",
        curriculumId: "c-1",
        readController: async () => ({}),
        writeController: async () => ({}),
        ...overrides,
    }) as AiToolContext;

afterEach(() => {
    vi.useRealTimers();
});

const withPinnedClock = (run: () => void) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z"));
    run();
};

describe("buildSystemPrompt", () => {
    it("states who is signed in and which iteration and gantt are open", () => {
        withPinnedClock(() => {
            const prompt = buildSystemPrompt(context());

            expect(prompt).toContain("המשתמש המחובר: מיכאל.");
            expect(prompt).toContain("המחזור בהקשר: 2026b.");
            expect(prompt).toContain("הגאנט שפתוח כרגע במסך: c-1.");
        });
    });

    it("falls back when no iteration or gantt is in context", () => {
        withPinnedClock(() => {
            const prompt = buildSystemPrompt(
                context({ iterationId: undefined, curriculumId: undefined }),
            );

            expect(prompt).toContain("המשתמש עובד על המחזור הנוכחי.");
            expect(prompt).toContain("אין גאנט פתוח במסך כרגע.");
        });
    });

    it("stamps today's date so relative questions anchor correctly", () => {
        withPinnedClock(() => {
            // Weekday and date both: "Tuesday" must resolve to a date (#719).
            expect(buildSystemPrompt(context())).toContain(
                "היום: יום ראשון, 2026-08-23",
            );
        });
    });

    it("always carries the standing rules, whatever the client replays", () => {
        withPinnedClock(() => {
            const prompt = buildSystemPrompt(context());

            // The core contract: Hebrew answers, look-before-write, preview
            // before a cut, human-gated writes, and no invented identifiers.
            expect(prompt).toContain("ענה תמיד בעברית");
            expect(prompt).toContain("כללי עבודה:");
            expect(prompt).toContain("preview_curriculum_cut");
            expect(prompt).toContain("cut_curriculum");
            expect(prompt).toContain("אל תמציא מזהים");
        });
    });
});
