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
 * Google itself is never reached. Server-side, the test ui container talks to
 * the `google-stub` service for the token exchange and the Calendar API
 * (deploy/docker-compose.test.yml, #579). Browser-side, the Google Identity
 * Services script is replaced per test with one whose popup immediately
 * returns an authorization code.
 */

/** Stands in for https://accounts.google.com/gsi/client: the popup "succeeds". */
const FAKE_GSI_SCRIPT = `
window.google = window.google || {};
window.google.accounts = {
    oauth2: {
        initCodeClient: (config) => ({
            requestCode: () => setTimeout(() => config.callback({ code: "e2e-stub-code" }), 0),
        }),
    },
};
`;

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

    test("connects through the stub, shows the connected controls, and disconnects (#579)", async ({
        page,
        request,
    }) => {
        await page.route("https://accounts.google.com/gsi/client", (route) =>
            route.fulfill({ contentType: "text/javascript", body: FAKE_GSI_SCRIPT }),
        );

        const dialog = page.locator(SELECTORS.settingsDialog).first();
        const heading = dialog.getByText("Google Calendar");
        await heading.scrollIntoViewIfNeeded();
        const googleSwitch = heading
            .locator("xpath=ancestor::div[3]")
            .locator(`${SELECTORS.switch} input`)
            .first();
        // Enabled only because the stack now has a (stub) client configured.
        await expect(googleSwitch).toBeEnabled();

        try {
            await googleSwitch.check();
            await expect(page.getByText("חשבון Google חובר בהצלחה.")).toBeVisible({
                timeout: 15_000,
            });

            const status = await request.get("/api/integrations/google-calendar/status");
            expect(status.ok()).toBeTruthy();
            expect((await status.json()).data).toMatchObject({
                configured: true,
                connected: true,
            });

            const syncNow = dialog.getByRole("button", { name: "סנכרן עכשיו" });
            const disconnect = dialog.getByRole("button", { name: "נתק חשבון" });
            await expect(syncNow).toBeVisible();
            await expect(disconnect).toBeVisible();
            await expect(dialog.getByText('סנכרון כל אירועי הלו"ז')).toBeVisible();

            // A sync round-trips the stub's Calendar API rather than failing.
            await syncNow.click();
            await expect(page.getByText(/^סונכרנו \d+ אירועים/)).toBeVisible({
                timeout: 30_000,
            });

            await disconnect.click();
            await expect(page.getByText("החיבור ל-Google Calendar נותק.")).toBeVisible();
            await expect(syncNow).toBeHidden();
            await expect(disconnect).toBeHidden();
            await expect(googleSwitch).not.toBeChecked();

            const after = await request.get("/api/integrations/google-calendar/status");
            expect((await after.json()).data.connected).toBe(false);
        } finally {
            // Never leave the shared test user linked for the specs above.
            await request.post("/api/integrations/google-calendar/disconnect");
        }
    });
});
