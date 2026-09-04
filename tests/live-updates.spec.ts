import {
    expect,
    gotoAppHome,
    openSecondUserSession,
    selectCalendarTimeRange,
    test,
    testId,
    waitForAppLoad,
    waitForRealtimeConnection,
} from "./fixtures";

/**
 * Live-update coverage across two users in two browser sessions (#582).
 *
 * Every other spec drives a single browser, which cannot tell a working
 * realtime layer from a dead one: the writer's own calendar updates from its
 * local mutation whether or not the broadcast ever leaves the server. That is
 * not a theoretical gap — #587 found the server->client channel had been dead
 * in every e2e run for weeks (`getaddrinfo ENOTFOUND bluz-sessions`) and the
 * suite stayed green the whole time, because broadcasts are fire-and-forget
 * and no route awaits them.
 *
 * These tests are the missing half: user A writes, and the assertion is made
 * on user B's screen, with no reload. The second session is a genuinely
 * different Hive account (see TEST_USERS in auth.setup.ts), so this also
 * covers the fan-out reaching a *different* user rather than just a second tab
 * of the same one.
 *
 * The hermetic counterpart, which pins the same delivery guarantees against
 * the real session-server core in milliseconds, is
 * tests/backend/ws-two-session-updates.test.ts. This spec is what proves the
 * whole chain — API route, session server, browser client, reducer, DOM —
 * is actually wired together end to end.
 */

/**
 * The gate for everything below, and for every other spec that quietly assumes
 * broadcasts arrive. It is deliberately outside the skipped describe: whatever
 * happens to the two-user specs, a stack whose browsers cannot reach the
 * session server must fail loudly rather than pass in silence (#636).
 */
test("the browser establishes its realtime session", async ({ page }) => {
    // Two 20s waits plus an app load do not fit the default per-test budget,
    // and a gate that dies on its own timeout reports "test timed out" instead
    // of the diagnosis it exists to give.
    test.setTimeout(90_000);

    await gotoAppHome(page);
    await waitForAppLoad(page);

    await waitForRealtimeConnection(page);
});

// These two were written without a working local e2e stack and had never
// passed, so they stayed skipped rather than de-flaked. Their first run
// (33798617692) died in the shared `selectCalendarTimeRange` helper -- the
// event dialog never opened -- before ever asserting on the broadcast. Both
// users now gate on the `data-realtime-host` marker asserted by
// `waitForRealtimeConnection` before either dialog interaction begins, so a
// dropped or misdirected socket fails loudly on the gate instead of flaking
// on a downstream assertion.
//
// The delivery guarantees they were written for are covered meanwhile by
// tests/backend/ws-two-session-updates.test.ts, which is hermetic, runs in
// under a second and does pass. #582 stays open until this spec has run
// green a few times in a row in the real suite.
test.describe("Live updates between two users (#582)", () => {
    // Two full app loads plus an SSO-authenticated second context, before the
    // assertion even begins — and now two `waitForRealtimeConnection` calls
    // per test, each good for up to 40s (two chained 20s expects) in the
    // failure mode they exist to catch. 120s was tight even before those
    // gates; keep the outer timeout comfortably above the summed per-assertion
    // budgets so a dead socket fails with the gate's diagnostic message
    // instead of a generic "Test timeout exceeded".
    test.describe.configure({ timeout: 180_000 });

    test("an event created by one user appears on the other user's calendar", async ({
        page,
        browser,
    }) => {
        const eventName = `שידור ${testId("live")}`;

        await gotoAppHome(page);
        await waitForAppLoad(page);
        await waitForRealtimeConnection(page);

        const { context: secondContext, page: secondPage } =
            await openSecondUserSession(browser);

        try {
            await gotoAppHome(secondPage);
            await waitForAppLoad(secondPage);
            await waitForRealtimeConnection(secondPage);

            // Baseline: B is not already showing the event, so a pass cannot
            // come from stale state or a name collision with seeded data.
            await expect(secondPage.getByText(eventName)).toHaveCount(0);

            // User A creates an event through the real UI.
            await selectCalendarTimeRange(page);
            const dialog = page
                .getByRole("dialog")
                .filter({ hasText: "עריכת מופע" });
            await expect(dialog).toBeVisible({ timeout: 30_000 });
            await dialog.getByLabel("שם").fill(eventName);
            await dialog.getByRole("button", { name: "שמירה" }).click();
            await expect(dialog).not.toBeVisible({ timeout: 30_000 });

            // The whole point: B never reloaded. If the broadcast does not
            // arrive, B's calendar simply never shows the event and this
            // fails — which is exactly the failure #587 slipped through.
            await expect(
                secondPage.getByText(eventName).first(),
                "the second user's calendar never received the new event over the websocket",
            ).toBeVisible({ timeout: 30_000 });
        } finally {
            await secondContext.close();
        }
    });

    test("an event deleted by one user disappears from the other user's calendar", async ({
        page,
        browser,
    }) => {
        const eventName = `מחיקה ${testId("live")}`;

        await gotoAppHome(page);
        await waitForAppLoad(page);
        await waitForRealtimeConnection(page);

        await selectCalendarTimeRange(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת מופע" });
        await expect(dialog).toBeVisible({ timeout: 30_000 });
        await dialog.getByLabel("שם").fill(eventName);
        await dialog.getByRole("button", { name: "שמירה" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 30_000 });

        const { context: secondContext, page: secondPage } =
            await openSecondUserSession(browser);

        try {
            await gotoAppHome(secondPage);
            await waitForAppLoad(secondPage);
            await waitForRealtimeConnection(secondPage);

            // B loads with the event present (it was saved before B connected),
            // so the assertion below is about the *removal* broadcast only.
            await expect(secondPage.getByText(eventName).first()).toBeVisible({
                timeout: 30_000,
            });

            // A deletes it.
            await page.getByText(eventName).first().click();
            const editDialog = page
                .getByRole("dialog")
                .filter({ hasText: "עריכת מופע" });
            await expect(editDialog).toBeVisible({ timeout: 30_000 });
            await editDialog.getByRole("button", { name: "מחיקה" }).click();
            await expect(editDialog).not.toBeVisible({ timeout: 30_000 });

            // A missed deletion is worse than a missed update: B keeps a
            // phantom event it can still open and re-save, silently resurrecting
            // data another user removed.
            await expect(
                secondPage.getByText(eventName),
                "the deleted event is still on the second user's calendar",
            ).toHaveCount(0, { timeout: 30_000 });
        } finally {
            await secondContext.close();
        }
    });
});
