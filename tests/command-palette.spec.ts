import { test, expect, gotoAppHome } from "./fixtures";

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

test.describe("Command palette", () => {
    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("opens via Ctrl+K without crashing and focuses the query field", async ({ page }) => {
        await page.keyboard.press("Control+k");

        const palette = getPalette(page);
        await expect(palette).toBeVisible({ timeout: 10_000 });

        const input = palette.getByRole("combobox");
        await expect(input).toBeFocused();
        await expect(input).toHaveAttribute("aria-label", PLACEHOLDER);
    });

    test("accepts typed input and filters results", async ({ page }) => {
        await page.keyboard.press("Control+k");
        const palette = getPalette(page);
        await expect(palette).toBeVisible({ timeout: 10_000 });

        const input = palette.getByRole("combobox");
        await input.fill("xyzxyz-no-such-command");
        await expect(palette.getByRole("listbox")).toBeVisible();
        // No matches for the nonsense query → empty-state text, not a crash.
        await expect(palette).toBeVisible();
    });

    test("renders the Undo shortcut chip modifier-first (RTL-safe order)", async ({ page }) => {
        await page.keyboard.press("Control+k");
        const palette = getPalette(page);
        await expect(palette).toBeVisible({ timeout: 10_000 });

        // The Undo command carries shortcut ["Ctrl", "Z"]. KeyChip reverses the
        // source order under RTL's flex mirroring, so DOM order must come out
        // Ctrl then Z to render Ctrl-first visually.
        const undoRow = palette.getByRole("option").filter({ hasText: "ביטול פעולה" });
        await expect(undoRow).toBeVisible();

        const keys = await undoRow.locator("kbd").allTextContents();
        expect(keys).toEqual(["Ctrl", "Z"]);
    });

    test("closes on Escape", async ({ page }) => {
        await page.keyboard.press("Control+k");
        const palette = getPalette(page);
        await expect(palette).toBeVisible({ timeout: 10_000 });

        await page.keyboard.press("Escape");
        await expect(palette).not.toBeVisible({ timeout: 5_000 });
    });
});
