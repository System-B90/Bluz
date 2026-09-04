import { expect, test, waitForAppLoad } from "./fixtures";

/**
 * The settings dialog's URL contract.
 *
 * `?settings=<tab>` is what makes a settings screen shareable and
 * refresh-proof, and `?editRoom=<id>` predates it — a link mailed before the
 * param existed must still land on the rooms tab. None of that is reachable
 * from a click, so nothing else in the suite exercises it.
 */

const TAB_LABELS = {
    personal: "אישי",
    colors: "צבעים",
    rooms: "חדרים",
    outsiders: "אנשי חוץ",
} as const;

const settingsDialog = (page: import("@playwright/test").Page) =>
    page.getByRole("dialog").filter({ hasText: "הגדרות" });

async function gotoWithQuery(
    page: import("@playwright/test").Page,
    query: string,
): Promise<void> {
    await page.goto(`/${query}`, { waitUntil: "commit", timeout: 60_000 });
    await waitForAppLoad(page);
}

/**
 * The sidebar item the dialog currently shows. The nav items are plain
 * buttons marked with `aria-current="page"`, not MUI tabs.
 */
async function selectedTab(
    page: import("@playwright/test").Page,
): Promise<string> {
    return (
        await settingsDialog(page)
            .locator('button[aria-current="page"]')
            .innerText()
    ).trim();
}

test.describe("Settings dialog deep links", () => {
    test.describe.configure({ timeout: 60_000 });

    test("opens straight onto the tab named in the URL", async ({ page }) => {
        await gotoWithQuery(page, "?settings=colors");

        await expect(settingsDialog(page)).toBeVisible();
        expect(await selectedTab(page)).toContain(TAB_LABELS.colors);
    });

    test("falls back to the personal tab for an unknown tab name", async ({
        page,
    }) => {
        await gotoWithQuery(page, "?settings=not-a-tab");

        await expect(settingsDialog(page)).toBeVisible();
        expect(await selectedTab(page)).toContain(TAB_LABELS.personal);
    });

    test("stays closed with no settings param", async ({ page }) => {
        await gotoWithQuery(page, "");

        await expect(settingsDialog(page)).toBeHidden();
    });

    test("still honours a legacy ?editRoom= link by opening the rooms tab", async ({
        page,
    }) => {
        await gotoWithQuery(page, "?editRoom=does-not-exist");

        await expect(settingsDialog(page)).toBeVisible();
        expect(await selectedTab(page)).toContain(TAB_LABELS.rooms);
    });

    test("writes the tab into the URL when the user switches tabs", async ({
        page,
    }) => {
        await gotoWithQuery(page, "?settings=personal");

        await settingsDialog(page)
            .getByRole("button", { name: TAB_LABELS.outsiders })
            .click();

        await expect(page).toHaveURL(/settings=outsiders/);
    });

    test("drops the settings param on close, keeping the rest of the query", async ({
        page,
    }) => {
        await gotoWithQuery(page, "?settings=rooms&editRoom=r-does-not-exist");

        await page.keyboard.press("Escape");

        await expect(settingsDialog(page)).toBeHidden();
        await expect(page).not.toHaveURL(/settings=/);
        await expect(page).not.toHaveURL(/editRoom=/);
    });

    test("survives a reload on the deep-linked tab", async ({ page }) => {
        await gotoWithQuery(page, "?settings=colors");
        await expect(settingsDialog(page)).toBeVisible();

        await page.reload({ waitUntil: "commit" });
        await waitForAppLoad(page);

        await expect(settingsDialog(page)).toBeVisible();
        expect(await selectedTab(page)).toContain(TAB_LABELS.colors);
    });
});
