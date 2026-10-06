import type { Page } from "@playwright/test";

import {
    expect,
    getEventDialog,
    gotoAppHome,
    openEventDialog,
    openSecondUserSession,
    selectCalendarTimeRange,
    switchToDayView,
    test,
    testId,
    waitForRealtimeConnection,
} from "./fixtures";

/**
 * E2e coverage for the event lock/unlock presence relay (#688).
 *
 * A real bug shipped here undetected: `lockEvent`/`unlockEvent` broadcast to
 * a sync object nobody had subscribed to while viewing the current run (the
 * broadcast's iterationId and the client's registered sync channel used two
 * different spellings of "the current run" — see the #582 note in
 * `UseEventWebsocket.ts`), so the presence indicator silently never worked.
 * It was caught only by manual testing. This spec is the missing e2e half —
 * user A opens an event for editing, and the assertion is made on user B's
 * screen, exactly like `live-updates.spec.ts` does for data broadcasts.
 */

/**
 * Dismisses a lingering event dialog, if any, so a failed assertion mid-test
 * doesn't leave the dialog's server-side `EVENT_LOCK` held into whatever
 * runs next. Mirrors the same helper in `live-updates.spec.ts`.
 */
async function releaseEventDialogIfOpen(page: Page): Promise<void> {
    const dialog = getEventDialog(page);
    if (await dialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press("Escape").catch(() => undefined);
    }
}

test.describe("Event lock presence relay (#688)", () => {
    test.describe.configure({ timeout: 120_000 });

    test("a second user sees the lock indicator while an event is open, and it clears on unlock", async ({
        page,
        browser,
    }) => {
        const eventName = `נעילה ${testId("lock")}`;
        let secondContext: Awaited<ReturnType<typeof openSecondUserSession>>["context"] | undefined;
        let secondPage: Awaited<ReturnType<typeof openSecondUserSession>>["page"] | undefined;

        try {
            await gotoAppHome(page);
            await waitForRealtimeConnection(page);

            // Create the event to lock. The new-event dialog has no id yet
            // (useEventLockLifecycle only locks an *existing* open event), so
            // this first dialog never broadcasts a lock — it is just setup.
            await selectCalendarTimeRange(page);
            const createDialog = getEventDialog(page);
            await expect(createDialog).toBeVisible({ timeout: 30_000 });
            await createDialog.getByLabel("שם").fill(eventName);
            await createDialog.getByRole("button", { name: "שמירה" }).click();
            await expect(createDialog).not.toBeVisible({ timeout: 30_000 });

            ({ context: secondContext, page: secondPage } =
                await openSecondUserSession(browser));

            await gotoAppHome(secondPage);
            await waitForRealtimeConnection(secondPage);
            await switchToDayView(secondPage);

            await expect(secondPage.getByText(eventName).first()).toBeVisible({
                timeout: 30_000,
            });

            // B opens the same event for editing first. Its own lock is
            // filtered out of its own view (applyLockUpdate ignores echoes of
            // the sender's own id), so at this point B shows no lock banner.
            const bDialog = await openEventDialog(secondPage, eventName);
            const lockBanner = bDialog.getByText("עורך כעת", {
                exact: false,
            });
            await expect(lockBanner).not.toBeVisible();

            // A now opens the same event. This is the broadcast under test:
            // it must reach B without a reload.
            await page.bringToFront();
            const aDialog = await openEventDialog(page, eventName);

            await expect(
                lockBanner,
                "the second user never saw the lock indicator for the event the first user opened",
            ).toBeVisible({ timeout: 15_000 });

            // A closes its dialog, releasing the lock. B's banner must clear
            // without B reloading or re-opening anything.
            await page.keyboard.press("Escape");
            await expect(aDialog).not.toBeVisible({ timeout: 10_000 });

            await expect(
                lockBanner,
                "the lock indicator never cleared on the second user's screen after the first user released it",
            ).not.toBeVisible({ timeout: 15_000 });
        } finally {
            await releaseEventDialogIfOpen(page);
            if (secondPage) await releaseEventDialogIfOpen(secondPage);
            await secondContext?.close();
        }
    });

    test("a quick edit of an event another user is editing asks loudly first (#775)", async ({
        page,
        browser,
    }) => {
        const eventName = `נעילה מהירה ${testId("lock-quick")}`;
        let secondContext: Awaited<ReturnType<typeof openSecondUserSession>>["context"] | undefined;
        let secondPage: Awaited<ReturnType<typeof openSecondUserSession>>["page"] | undefined;

        try {
            await gotoAppHome(page);
            await waitForRealtimeConnection(page);
            await selectCalendarTimeRange(page);
            const createDialog = getEventDialog(page);
            await expect(createDialog).toBeVisible({ timeout: 30_000 });
            await createDialog.getByLabel("שם").fill(eventName);
            await createDialog.getByRole("button", { name: "שמירה" }).click();
            await expect(createDialog).not.toBeVisible({ timeout: 30_000 });

            ({ context: secondContext, page: secondPage } =
                await openSecondUserSession(browser));
            await gotoAppHome(secondPage);
            await waitForRealtimeConnection(secondPage);
            await switchToDayView(secondPage);
            const bTile = secondPage.getByText(eventName).first();
            await expect(bTile).toBeVisible({ timeout: 30_000 });

            // A holds the lock by keeping the edit dialog open.
            await page.bringToFront();
            await openEventDialog(page, eventName);

            await secondPage.bringToFront();
            const lockedConfirm = secondPage
                .getByRole("dialog")
                .filter({ hasText: "המופע נערך כרגע" });

            // Backing out leaves the event where it was.
            await expect(async () => {
                await bTile.click({ button: "right" });
                await secondPage!.getByRole("menuitem", { name: "דחייה בשבוע" }).click();
                await expect(lockedConfirm).toBeVisible({ timeout: 2_000 });
            }).toPass({ timeout: 20_000 });
            await expect(lockedConfirm).toContainText("עלולה לגרום להתנהגות לא צפויה");
            await lockedConfirm.getByRole("button", { name: "ביטול" }).click();
            await expect(lockedConfirm).not.toBeVisible();
            await expect(bTile).toBeVisible();

            // Confirming applies the edit: postponed a week, off today's view.
            await bTile.click({ button: "right" });
            await secondPage.getByRole("menuitem", { name: "דחייה בשבוע" }).click();
            await lockedConfirm.getByRole("button", { name: "לערוך בכל זאת" }).click();
            await expect(secondPage.getByText(eventName)).toHaveCount(0, { timeout: 15_000 });
        } finally {
            await releaseEventDialogIfOpen(page);
            if (secondPage) await releaseEventDialogIfOpen(secondPage);
            await secondContext?.close();
        }
    });

    test("the Delete key on an event another user is editing asks loudly first (#775)", async ({
        page,
        browser,
    }) => {
        const eventName = `נעילת מחיקה ${testId("lock-delete")}`;
        let secondContext: Awaited<ReturnType<typeof openSecondUserSession>>["context"] | undefined;
        let secondPage: Awaited<ReturnType<typeof openSecondUserSession>>["page"] | undefined;

        try {
            await gotoAppHome(page);
            await waitForRealtimeConnection(page);
            await selectCalendarTimeRange(page);
            const createDialog = getEventDialog(page);
            await expect(createDialog).toBeVisible({ timeout: 30_000 });
            await createDialog.getByLabel("שם").fill(eventName);
            await createDialog.getByRole("button", { name: "שמירה" }).click();
            await expect(createDialog).not.toBeVisible({ timeout: 30_000 });

            ({ context: secondContext, page: secondPage } =
                await openSecondUserSession(browser));
            await gotoAppHome(secondPage);
            await waitForRealtimeConnection(secondPage);
            await switchToDayView(secondPage);
            const bTile = secondPage.getByText(eventName).first();
            await expect(bTile).toBeVisible({ timeout: 30_000 });

            await page.bringToFront();
            await openEventDialog(page, eventName);

            await secondPage.bringToFront();
            const lockedConfirm = secondPage
                .getByRole("dialog")
                .filter({ hasText: "המופע נערך כרגע" });

            // Cancelling keeps the event.
            await expect(async () => {
                await bTile.click();
                await secondPage!.keyboard.press("Delete");
                await expect(lockedConfirm).toBeVisible({ timeout: 2_000 });
            }).toPass({ timeout: 20_000 });
            await lockedConfirm.getByRole("button", { name: "ביטול" }).click();
            await expect(lockedConfirm).not.toBeVisible();
            await expect(bTile).toBeVisible();

            // Confirming deletes it.
            await bTile.click();
            await secondPage.keyboard.press("Delete");
            await lockedConfirm.getByRole("button", { name: "לערוך בכל זאת" }).click();
            await expect(secondPage.getByText(eventName)).toHaveCount(0, { timeout: 15_000 });
        } finally {
            await releaseEventDialogIfOpen(page);
            if (secondPage) await releaseEventDialogIfOpen(secondPage);
            await secondContext?.close();
        }
    });
});