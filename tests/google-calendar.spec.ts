import {
    test,
    expect,
    SELECTORS,
    openSettingsDialog,
    navigateToSettingsTab,
    gotoAppHome,
} from "./fixtures";

/**
 * Google Calendar integration card in personal settings.
 *
 * The full connect flow needs a real Google OAuth popup (Google Identity
 * Services) and a configured GOOGLE_CLIENT_ID/SECRET — the test environment's
 * `test-ui` container deliberately gets neither (see deploy/docker-compose.test.yml),
 * matching an "offline deployment" the app is meant to degrade gracefully for.
 * This suite verifies that degraded, unconfigured state deterministically
 * rather than attempting a real OAuth round-trip.
 */

test.describe("Google Calendar integration", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
        await openSettingsDialog(page);
        await navigateToSettingsTab(page, "אישי");
    });

    test("renders the card with an off, unchecked toggle while disconnected", async ({
        page,
    }) => {
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        const heading = dialog.getByText("Google Calendar");
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
        await expect(
            dialog.getByText("סנכרון דו-כיווני", { exact: false }),
        ).toBeVisible();

        // The switch nearest the Google Calendar heading — unchecked while
        // no account is connected. (Whether it's enabled depends on whether
        // this deployment has a Google client configured server-side, which
        // this test doesn't assume either way.)
        const googleSwitch = heading
            .locator("xpath=ancestor::div[3]")
            .locator(`${SELECTORS.switch} input`);
        await expect(googleSwitch).toBeVisible();
        await expect(googleSwitch).not.toBeChecked();
    });

    test("does not show sync-all-events or disconnect controls when disconnected", async ({
        page,
    }) => {
        const dialog = page.locator(SELECTORS.settingsDialog).first();

        await expect(dialog.getByText("Google Calendar")).toBeVisible();
        await expect(
            dialog.getByText('סנכרון כל אירועי הלו"ז'),
        ).toBeHidden();
        await expect(
            dialog.getByRole("button", { name: "נתק חשבון" }),
        ).toBeHidden();
        await expect(
            dialog.getByRole("button", { name: "סנכרן עכשיו" }),
        ).toBeHidden();
    });
});
