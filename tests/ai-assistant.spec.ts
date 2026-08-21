import { test, expect, gotoAppHome } from "./fixtures";
import type { Page, Route } from "@playwright/test";

/**
 * End-to-end coverage for the floating AI assistant.
 *
 * The model backend is stubbed at the network boundary rather than called for
 * real: an e2e run must not depend on a third-party API being up, on a key
 * being present in CI, or on a non-deterministic answer. What is exercised for
 * real is everything Bluz owns — the launcher, SSE decoding in the browser,
 * the timeline, and above all the approval gate.
 */

const LAUNCHER = "button[aria-label='ai-assistant']";
const INPUT = "שאל שאלה או בקש שינוי…";

/** One SSE frame, in the wire format the route emits. */
function frame(event: unknown): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}

const doneFrame = (messages: Array<unknown> = [], awaitingApproval = false) =>
    frame({ type: "done", messages, awaitingApproval, model: "test-model" });

/** Serves a scripted SSE body, one script per successive turn. */
async function stubChat(page: Page, turns: Array<string>) {
    let turn = 0;
    await page.route("**/api/ai/chat", async (route: Route) => {
        await route.fulfill({
            status: 200,
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-store",
            },
            body: turns[turn++] ?? doneFrame(),
        });
    });
}

/** Reports the assistant as configured, so the launcher renders. */
async function stubTools(page: Page, enabled = true) {
    await page.route("**/api/ai/tools", async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: 0, data: { enabled, tools: [] } }),
        });
    });
}

async function openAssistant(page: Page) {
    await expect(page.locator(LAUNCHER)).toBeVisible({ timeout: 30_000 });
    await page.locator(LAUNCHER).click();
    await expect(page.getByPlaceholder(INPUT)).toBeVisible();
}

async function ask(page: Page, question: string) {
    await page.getByPlaceholder(INPUT).fill(question);
    await page.getByPlaceholder(INPUT).press("Enter");
}

test.describe("AI assistant", () => {
    test("hides the launcher when no model backend is configured", async ({
        page,
    }) => {
        // A deployment with no API key must not advertise an entry point that
        // fails on first use.
        await stubTools(page, false);
        await gotoAppHome(page);

        await expect(page.locator(LAUNCHER)).toHaveCount(0);
    });

    test("answers a question with streamed text", async ({ page }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({ type: "delta", text: "יש " }) +
                frame({ type: "delta", text: "שלושה " }) +
                frame({ type: "delta", text: "אירועים." }) +
                doneFrame([{ role: "assistant", content: "יש שלושה אירועים." }]),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);

        await ask(page, 'מה יש בלו"ז?');

        // Every delta has to land in one bubble; a dropped first chunk is the
        // exact regression the unit test for the hook also pins.
        await expect(page.getByText("יש שלושה אירועים.")).toBeVisible({
            timeout: 15_000,
        });
    });

    test("shows read-tool activity in the transcript", async ({ page }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({
                type: "tool_start",
                toolCallId: "c1",
                name: "list_events",
            }) +
                frame({
                    type: "tool_result",
                    toolCallId: "c1",
                    name: "list_events",
                    summary: "נמצאו 3 אירועים בטווח",
                    ok: true,
                }) +
                frame({ type: "delta", text: "מצאתי." }) +
                doneFrame(),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);

        await ask(page, 'מה יש בלו"ז?');

        await expect(
            page.getByText("list_events: נמצאו 3 אירועים בטווח"),
        ).toBeVisible({ timeout: 15_000 });
    });

    test("a write waits for approval and sends the approved id", async ({
        page,
    }) => {
        await stubTools(page);
        const assistantTurn = [
            {
                role: "assistant",
                content: "",
                toolCalls: [
                    { id: "w1", name: "delete_event", arguments: '{"id":"e1"}' },
                ],
            },
        ];
        await stubChat(page, [
            frame({
                type: "tool_proposal",
                toolCallId: "w1",
                name: "delete_event",
                arguments: { id: "e1" },
                summary: "מחיקת אירוע e1",
            }) + doneFrame(assistantTurn, true),
            frame({
                type: "tool_result",
                toolCallId: "w1",
                name: "delete_event",
                summary: 'נמחק אירוע "שיעור"',
                ok: true,
            }) +
                frame({ type: "delta", text: "נמחק." }) +
                doneFrame(),
        ]);

        const approvals: Array<Array<string>> = [];
        page.on("request", (request) => {
            if (!request.url().includes("/api/ai/chat")) return;
            approvals.push(request.postDataJSON()?.approvedToolCallIds ?? []);
        });

        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "תמחק את האירוע");

        // The proposal is shown and nothing has run yet.
        await expect(page.getByText("מחיקת אירוע e1")).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByRole("button", { name: "אישור" })).toBeVisible();

        await page.getByRole("button", { name: "אישור" }).click();
        await expect(page.getByText('delete_event: נמחק אירוע "שיעור"')).toBeVisible(
            { timeout: 15_000 },
        );

        // First turn asks for nothing; the resume carries exactly the id the
        // user saw and approved.
        expect(approvals[0]).toEqual([]);
        expect(approvals[1]).toEqual(["w1"]);
    });

    test("declining a write runs nothing and answers the tool call", async ({
        page,
    }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({
                type: "tool_proposal",
                toolCallId: "w1",
                name: "delete_event",
                arguments: { id: "e1" },
                summary: "מחיקת אירוע e1",
            }) +
                doneFrame(
                    [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [
                                {
                                    id: "w1",
                                    name: "delete_event",
                                    arguments: '{"id":"e1"}',
                                },
                            ],
                        },
                    ],
                    true,
                ),
            frame({ type: "delta", text: "בסדר, לא נגעתי." }) + doneFrame(),
        ]);

        const bodies: Array<any> = [];
        page.on("request", (request) => {
            if (request.url().includes("/api/ai/chat")) {
                bodies.push(request.postDataJSON());
            }
        });

        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "תמחק את האירוע");

        await expect(page.getByRole("button", { name: "ביטול" })).toBeVisible({
            timeout: 15_000,
        });
        await page.getByRole("button", { name: "ביטול" }).click();

        await expect(page.getByText("delete_event: הפעולה נדחתה")).toBeVisible({
            timeout: 15_000,
        });

        // The refusal is written back as the tool call's result — an
        // unanswered call would make every later request malformed.
        await expect(async () => {
            expect(bodies.length).toBe(2);
        }).toPass({ timeout: 15_000 });
        expect(bodies[1].approvedToolCallIds).toEqual([]);
        expect(bodies[1].messages.at(-1)).toMatchObject({
            role: "tool",
            toolCallId: "w1",
        });
    });

    test("surfaces a server error without wedging the panel", async ({
        page,
    }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({ type: "error", message: "שירות ה-AI אינו זמין" }),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);

        await ask(page, "היי");

        await expect(page.getByText("שירות ה-AI אינו זמין")).toBeVisible({
            timeout: 15_000,
        });
        // The input stays usable, so a failed turn is recoverable.
        await expect(page.getByPlaceholder(INPUT)).toBeEnabled();
    });

    test("scopes the turn to the iteration the user is viewing", async ({
        page,
    }) => {
        await stubTools(page);
        await stubChat(page, [doneFrame()]);

        const bodies: Array<any> = [];
        page.on("request", (request) => {
            if (request.url().includes("/api/ai/chat")) {
                bodies.push(request.postDataJSON());
            }
        });

        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "היי");

        await expect(async () => {
            expect(bodies.length).toBe(1);
        }).toPass({ timeout: 15_000 });

        // The transcript starts with just the user's message — the system
        // prompt is server-owned and must never be sent from the browser.
        expect(bodies[0].messages).toEqual([{ role: "user", content: "היי" }]);
        // No gantt is open on the schedule screen, so no curriculum is claimed.
        expect(bodies[0].curriculumId).toBeUndefined();
    });

    test("starts a fresh conversation on reset", async ({ page }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({ type: "delta", text: "ראשון" }) +
                doneFrame([{ role: "assistant", content: "ראשון" }]),
            frame({ type: "delta", text: "שני" }) + doneFrame(),
        ]);

        const bodies: Array<any> = [];
        page.on("request", (request) => {
            if (request.url().includes("/api/ai/chat")) {
                bodies.push(request.postDataJSON());
            }
        });

        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "א");
        await expect(page.getByText("ראשון")).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "שיחה חדשה" }).click();
        await expect(page.getByText("ראשון")).toHaveCount(0);

        await ask(page, "ב");
        await expect(async () => {
            expect(bodies.length).toBe(2);
        }).toPass({ timeout: 15_000 });
        // A cleared conversation must not resurrect the previous transcript.
        expect(bodies[1].messages).toHaveLength(1);
    });
});
