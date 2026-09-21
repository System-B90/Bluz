import type { Page } from "@playwright/test";
import {
    dblclickCalendarEvent,
    expect,
    getEventDialog,
    gotoAppHome,
    openSecondUserSession,
    selectCalendarTimeRange,
    switchToDayView,
    test,
    testId,
    waitForRealtimeConnection,
} from "./fixtures";

/**
 * Dismisses a lingering event dialog, if any, so a failed assertion mid-test
 * doesn't leave the dialog's server-side `EVENT_LOCK` held into whatever
 * runs next. Best-effort: never throws, so it's safe to call unconditionally
 * from a `finally` block.
 */
async function releaseEventDialogIfOpen(page: Page): Promise<void> {
    const dialog = getEventDialog(page);
    if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press("Escape").catch(() => undefined);
    }
}

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

    await waitForRealtimeConnection(page);
});

// These two were written without a working local e2e stack and had never
// passed, so they stayed skipped rather than de-flaked. Their first run
// (33798617692) died in the shared `selectCalendarTimeRange` helper -- the
// event dialog never opened. That failure was in pure client-side drag/React
// state, not the realtime layer, and a review of this fix (#651) correctly
// called out that gating on `waitForRealtimeConnection` alone does nothing
// for it: the real fixes are `page.bringToFront()` before driving a
// background tab (Chromium can drop synthetic pointer events on an
// unfocused page) and using `dblclickCalendarEvent`, not a single click, to
// open the edit dialog (`onSelectEvent` only sets the active event;
// `onDoubleClickEvent` is what opens it). The realtime gate stays because it
// still matters for its own failure mode -- a dead or misdirected socket
// should fail loudly on the gate, not flake on the broadcast assertion 30s
// later.
//
// The delivery guarantees they were written for are covered meanwhile by
// tests/backend/ws-two-session-updates.test.ts, which is hermetic, runs in
// under a second and does pass. #582 stays open until this spec has run
// green a few times in a row in the real suite.
test.describe("Live updates between two users (#582)", () => {
    // Two full app loads plus an SSO-authenticated second context, before the
    // assertion even begins — plus two `waitForRealtimeConnection` calls per
    // test, each good for up to 40s (two chained 20s expects) in the failure
    // mode they exist to catch. Keep the outer timeout comfortably above the
    // summed per-assertion budgets so a dead socket fails with the gate's
    // diagnostic message instead of a generic "Test timeout exceeded".
    test.describe.configure({ timeout: 180_000 });

    test("an event created by one user appears on the other user's calendar", async ({
        page,
        browser,
    }) => {
        const eventName = `שידור ${testId("live")}`;

        await gotoAppHome(page);
        await waitForRealtimeConnection(page);

        const { context: secondContext, page: secondPage } =
            await openSecondUserSession(browser);

        try {
            await gotoAppHome(secondPage);
            await waitForRealtimeConnection(secondPage);

            // Match A's view. `selectCalendarTimeRange` switches A to the day
            // view and creates the event in the first room column there; B's
            // default week view puts that same event in a single crowded day
            // column, overlapped by seeded demo events, where its title
            // collapses to a zero-width box and reads as hidden. That is
            // react-big-calendar's overlap layout, not the realtime layer this
            // spec exists to test — so assert somewhere the tile has room.
            await switchToDayView(secondPage);

            // Baseline: B is not already showing the event, so a pass cannot
            // come from stale state or a name collision with seeded data.
            await expect(secondPage.getByText(eventName)).toHaveCount(0);

            // Opening the second session's page focuses it; bring A back to
            // the front before driving it, since Chromium can drop synthetic
            // mouse events dispatched at a background tab.
            await page.bringToFront();

            // User A creates an event through the real UI.
            await selectCalendarTimeRange(page);
            const dialog = getEventDialog(page);
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
            await releaseEventDialogIfOpen(page);
            await releaseEventDialogIfOpen(secondPage);
            await secondContext.close();
        }
    });

    test("an event deleted by one user disappears from the other user's calendar", async ({
        page,
        browser,
    }) => {
        const eventName = `מחיקה ${testId("live")}`;
        let secondContext: Awaited<ReturnType<typeof openSecondUserSession>>["context"] | undefined;
        let secondPage: Awaited<ReturnType<typeof openSecondUserSession>>["page"] | undefined;

        try {
            await gotoAppHome(page);
            await waitForRealtimeConnection(page);

            await selectCalendarTimeRange(page);
            const dialog = getEventDialog(page);
            await expect(dialog).toBeVisible({ timeout: 30_000 });
            await dialog.getByLabel("שם").fill(eventName);
            await dialog.getByRole("button", { name: "שמירה" }).click();
            await expect(dialog).not.toBeVisible({ timeout: 30_000 });

            ({ context: secondContext, page: secondPage } =
                await openSecondUserSession(browser));

            await gotoAppHome(secondPage);
            await waitForRealtimeConnection(secondPage);

            // Same reason as the creation test: assert in the day view, where
            // the tile is not overlapped into a zero-width box.
            await switchToDayView(secondPage);

            // B loads with the event present (it was saved before B connected),
            // so the assertion below is about the *removal* broadcast only.
            await expect(secondPage.getByText(eventName).first()).toBeVisible({
                timeout: 30_000,
            });

            // A deletes it. Only a double-click opens the edit dialog — a
            // single click just sets the active/selected event.
            await page.bringToFront();
            await dblclickCalendarEvent(page, eventName);
            const editDialog = getEventDialog(page);
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
            await releaseEventDialogIfOpen(page);
            if (secondPage) await releaseEventDialogIfOpen(secondPage);
            await secondContext?.close();
        }
    });
});
