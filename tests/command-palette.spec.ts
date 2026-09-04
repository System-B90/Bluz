import {
    test,
    expect,
    gotoAppHome,
    waitForAppLoad,
    getEventDialog,
    selectCalendarTimeRange,
    testId,
} from "./fixtures";

/**
 * Command palette integration tests.
 *
 * Regression coverage for a crash where a nested `::placeholder` selector on
 * the InputBase broke stylis-plugin-rtl during render ("Cannot read
 * properties of undefined (reading 'push')") — the dialog would fail to
 * mount at all. Also covers the RTL shortcut-chip ordering fix in KeyChip.
 */

const PLACEHOLDER = "הקלידו פקודה, או חפשו סילבוס, חדר, גאנט…";

function getPalette(page: import("@playwright/test").Page) {
    return page.getByRole("dialog").filter({ has: page.getByRole("combobox") });
}

/**
 * Opens the palette through the header button. The Ctrl+K hotkey has its own
 * test — every other case goes through the click path so a hotkey regression
 * doesn't cascade into unrelated failures.
 */
async function openPalette(page: import("@playwright/test").Page) {
    const palette = getPalette(page);
    // The trigger is visible before hydration attaches its handler, so a single
    // click can land on a dead button. Retry until the dialog actually mounts.
    await expect(async () => {
        await page.getByRole("button", { name: "פתיחת שורת הפקודות" }).click();
        await expect(palette).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    return palette;
}

test.describe("Command palette", () => {
    // The suite's global 15s budget doesn't cover a cold app load plus the
    // hydration retry loop below.
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("opens without crashing and focuses the query field", async ({ page }) => {
        const palette = await openPalette(page);

        const input = palette.getByRole("combobox");
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute("aria-label", PLACEHOLDER);
    });

    test("opens via the Ctrl+K hotkey", async ({ page }) => {
        // The listener is on window and is attached at hydration, so focus the
        // page and retry until the binding is live.
        await expect(async () => {
            await page.locator("body").click({ position: { x: 5, y: 5 } });
            await page.keyboard.press("Control+k");
            await expect(getPalette(page)).toBeVisible({ timeout: 2_000 });
        }).toPass({ timeout: 20_000 });
    });

    test("accepts typed input and filters results", async ({ page }) => {
        const palette = await openPalette(page);

        await palette.getByRole("combobox").fill("xyzxyz-no-such-command");
        // No matches for the nonsense query → empty state, not a crash.
        await expect(palette).toBeVisible();
        await expect(palette.getByRole("option")).toHaveCount(0);
    });

    test("renders the Undo shortcut chip modifier-first (RTL-safe order)", async ({ page }) => {
        const palette = await openPalette(page);

        // The Undo command carries shortcut ["Ctrl", "Z"]. KeyChip reverses the
        // source order under RTL's flex mirroring, so DOM order must come out
        // Ctrl then Z to render Ctrl-first visually.
        const undoRow = palette
            .getByRole("option")
            .filter({ hasText: "ביטול פעולה" });
        await expect(undoRow).toBeVisible();

        // DOM order is deliberately reversed (see ShortcutKeys) because the RTL
        // plugin mirrors flex-direction, so assert on painted position instead.
        const caps = undoRow.locator("kbd");
        const boxes = await Promise.all(
            (await caps.all()).map(async (cap) => ({
                text: (await cap.textContent())?.trim(),
                x: (await cap.boundingBox())?.x ?? 0,
            })),
        );
        const leftToRight = boxes
            .sort((a, b) => a.x - b.x)
            .map((cap) => cap.text);
        expect(leftToRight).toEqual(["Ctrl", "Z"]);
    });

    test("closes on Escape", async ({ page }) => {
        const palette = await openPalette(page);

        await page.keyboard.press("Escape");
        await expect(palette).not.toBeVisible({ timeout: 5_000 });
    });

    test("lists the loaded week's events on the schedule page, scoped to it", async ({ page }) => {
        const eventName = testId("palette-event");

        // Create a real event on the calendar so the entity lane has
        // something of ours to find.
        await selectCalendarTimeRange(page);
        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await dialog.locator("input").first().fill(eventName);
        await dialog.getByRole("button", { name: "שמירה" }).click();
        await expect(dialog).not.toBeVisible({ timeout: 5_000 });

        // Schedule surface: the calendar's events are contributed to the
        // entity lane.
        const schedulePalette = await openPalette(page);
        await schedulePalette.getByRole("combobox").fill(eventName);
        await expect(
            schedulePalette.getByRole("option").filter({ hasText: eventName }),
        ).toBeVisible({ timeout: 10_000 });
        await page.keyboard.press("Escape");
        await expect(schedulePalette).not.toBeVisible();

        // Gantt surface: BluzCalendar is unmounted here, so its event
        // commands must not follow the user across pages.
        await page.goto("/gantt", { waitUntil: "commit" });
        await waitForAppLoad(page);
        const ganttPalette = await openPalette(page);
        await ganttPalette.getByRole("combobox").fill(eventName);
        await expect(ganttPalette.getByRole("option")).toHaveCount(0);
    });
});
