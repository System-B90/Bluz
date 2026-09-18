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

/**
 * The chat panel itself. Assertions have to be scoped to it: the calendar
 * underneath is dense Hebrew text, and a bare `getByText` will happily match
 * a day-column header instead of a chat bubble.
 */
function panel(page: Page) {
    return page
        .locator(".MuiPaper-root")
        .filter({ has: page.getByPlaceholder(INPUT) });
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
    // The default 15s budget is spent almost entirely on loading the app —
    // every test here signs in, waits for hydration and then drives two chat
    // turns. Same override every other app-loading spec uses.
    test.describe.configure({ timeout: 60_000 });

    test("hides the launcher when no model backend is configured", async ({
        page,
    }) => {
        // A deployment with no API key must not advertise an entry point that
        // fails on first use.
        //
        // `enabled` starts `null` (probe in flight) and the launcher renders
        // nothing for both `null` and `false` — asserting count 0 right after
        // navigation cannot tell "server said disabled" from "the probe never
        // resolved". Waiting for the actual /api/ai/tools response, and
        // asserting on its body, pins down which one happened.
        await stubTools(page, false);
        const toolsResponse = page.waitForResponse("**/api/ai/tools");
        await gotoAppHome(page);

        const response = await toolsResponse;
        const body = await response.json();
        expect(body.data.enabled).toBe(false);

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
        await expect(panel(page).getByText("יש שלושה אירועים.")).toBeVisible({
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
                title: 'אירועי הלו"ז',
            }) +
                frame({
                    type: "tool_result",
                    toolCallId: "c1",
                    name: "list_events",
                    title: 'אירועי הלו"ז',
                    summary: "נמצאו 3 אירועים בטווח",
                    ok: true,
                    durationMs: 120,
                }) +
                frame({ type: "delta", text: "מצאתי." }) +
                doneFrame(),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);

        await ask(page, 'מה יש בלו"ז?');

        // The friendly title is what a user sees; the snake_case wire name
        // never reaches the panel.
        await expect(
            panel(page).getByText('אירועי הלו"ז', { exact: true }),
        ).toBeVisible({ timeout: 15_000 });
        await expect(
            panel(page).getByText("נמצאו 3 אירועים בטווח"),
        ).toBeVisible();
        await expect(panel(page).getByText("list_events")).toHaveCount(0);
    });

    test("interleaves tool activity with the text around it", async ({
        page,
    }) => {
        // A turn whose prose all collapses into one bubble reads as if the
        // assistant answered before it looked anything up, which is exactly
        // what makes a multi-step answer impossible to audit.
        await stubTools(page);
        await stubChat(page, [
            frame({ type: "delta", text: "בודק את הלוח…" }) +
                frame({
                    type: "tool_start",
                    toolCallId: "c1",
                    name: "list_events",
                    title: 'אירועי הלו"ז',
                }) +
                frame({
                    type: "tool_result",
                    toolCallId: "c1",
                    name: "list_events",
                    title: 'אירועי הלו"ז',
                    summary: "נמצאו 3 אירועים בטווח",
                    ok: true,
                }) +
                frame({ type: "delta", text: "נמצאו שלושה אירועים." }) +
                doneFrame(),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, 'מה יש בלו"ז?');

        const first = panel(page).getByText("בודק את הלוח…");
        const chip = panel(page).getByText("נמצאו 3 אירועים בטווח");
        const second = panel(page).getByText("נמצאו שלושה אירועים.");
        await expect(second).toBeVisible({ timeout: 15_000 });

        const order = await Promise.all(
            [first, chip, second].map((locator) =>
                locator.evaluate((element) => {
                    const all = [
                        ...document.querySelectorAll("*"),
                    ];
                    return all.indexOf(element);
                }),
            ),
        );
        expect(order[0]).toBeLessThan(order[1]);
        expect(order[1]).toBeLessThan(order[2]);
    });

    test("keeps the model's reasoning collapsed until asked for", async ({
        page,
    }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({ type: "reasoning", text: "מחשבה-פנימית-בדיקה" }) +
                frame({ type: "delta", text: "התשובה." }) +
                doneFrame(),
        ]);
        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "היי");

        await expect(panel(page).getByText("התשובה.")).toBeVisible({
            timeout: 15_000,
        });
        // Collapsed by default: a block that expanded itself would push the
        // answer off-screen on every turn.
        await expect(
            panel(page).getByText("מחשבה-פנימית-בדיקה"),
        ).toHaveCount(0);

        await panel(page).getByText("תהליך החשיבה").click();
        await expect(
            panel(page).getByText("מחשבה-פנימית-בדיקה"),
        ).toBeVisible();
    });

    test("answers an ask_user question with the option clicked", async ({
        page,
    }) => {
        await stubTools(page);
        await stubChat(page, [
            frame({
                type: "choice",
                toolCallId: "q1",
                question: "באיזה שיעור מדובר?",
                options: [
                    { value: "fx-1", label: "יום שני" },
                    { value: "fx-2", label: "יום רביעי" },
                ],
                allowFreeText: true,
            }) +
                doneFrame(
                    [
                        {
                            role: "assistant",
                            content: "",
                            toolCalls: [
                                { id: "q1", name: "ask_user", arguments: "{}" },
                            ],
                        },
                    ],
                    true,
                ),
            frame({ type: "delta", text: "הזזתי." }) + doneFrame(),
        ]);

        const bodies: Array<any> = [];
        page.on("request", (request) => {
            if (request.url().includes("/api/ai/chat")) {
                bodies.push(request.postDataJSON());
            }
        });

        await gotoAppHome(page);
        await openAssistant(page);
        await ask(page, "תזיז את השיעור");

        await expect(
            panel(page).getByText("באיזה שיעור מדובר?"),
        ).toBeVisible({ timeout: 15_000 });
        await page.getByRole("button", { name: "יום רביעי" }).click();

        await expect(panel(page).getByText("הזזתי.")).toBeVisible({
            timeout: 15_000,
        });
        // The server never ran `ask_user`, so the browser owes the model that
        // call's result — without it the next request is malformed.
        const answer = bodies[1].messages.at(-1);
        expect(answer).toMatchObject({ role: "tool", toolCallId: "q1" });
        expect(JSON.parse(answer.content)).toMatchObject({
            data: { answer: "fx-2" },
        });
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
                title: "מחיקת אירוע",
                danger: "destructive",
                arguments: { id: "e1" },
                summary: "מחיקת אירוע e1",
                impact: ['האירוע יוסר מהלו"ז של כל מי שרואה את המחזור.'],
            }) + doneFrame(assistantTurn, true),
            frame({
                type: "tool_result",
                toolCallId: "w1",
                name: "delete_event",
                title: "מחיקת אירוע",
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

        // The proposal is shown, with its consequences, and nothing has run.
        await expect(panel(page).getByText("מחיקת אירוע e1")).toBeVisible({
            timeout: 15_000,
        });
        await expect(
            panel(page).getByText('האירוע יוסר מהלו"ז של כל מי שרואה את המחזור.'),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "אישור" })).toBeVisible();

        // A destructive call takes two clicks: the first arms, the second —
        // labelled with what is about to happen — executes.
        await page.getByRole("button", { name: "אישור" }).click();
        expect(approvals).toHaveLength(1);
        await page.getByRole("button", { name: "כן, בצע" }).click();

        await expect(panel(page).getByText('נמחק אירוע "שיעור"')).toBeVisible({
            timeout: 15_000,
        });
        await expect(panel(page).getByText("אושר על ידך")).toBeVisible();

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
                title: "מחיקת אירוע",
                danger: "destructive",
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

        // The card stays in place as a record of the decision.
        await expect(panel(page).getByText("נדחה על ידך")).toBeVisible({
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

        await expect(panel(page).getByText("שירות ה-AI אינו זמין")).toBeVisible({
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
            frame({ type: "delta", text: "תשובת-בדיקה-אלף" }) +
                doneFrame([
                    { role: "assistant", content: "תשובת-בדיקה-אלף" },
                ]),
            frame({ type: "delta", text: "תשובת-בדיקה-בית" }) + doneFrame(),
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
        await expect(
            panel(page).getByText("תשובת-בדיקה-אלף"),
        ).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "שיחה חדשה" }).click();
        await expect(panel(page).getByText("תשובת-בדיקה-אלף")).toHaveCount(0);

        await ask(page, "ב");
        await expect(async () => {
            expect(bodies.length).toBe(2);
        }).toPass({ timeout: 15_000 });
        // A cleared conversation must not resurrect the previous transcript.
        expect(bodies[1].messages).toHaveLength(1);
    });
});
