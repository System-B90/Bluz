import { expect, test, waitForAppLoad } from "./fixtures";
import { createCurriculum, createSyllabus } from "./gantt-api";

/**
 * The syllabuses tab scrolls down, not sideways (#759).
 *
 * Cards used to flow into columns inside a horizontal scroller, so in RTL
 * users had to drag left to reach the rest.
 */

const SUITE_TAG = "e2e-syllabus-layout";
const COUNT = 6;

test.describe("Syllabus cards scroll vertically (#759)", () => {
    test.describe.configure({ timeout: 120_000 });

    let curriculumId: string;

    test.beforeEach(async ({ page, request }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        curriculumId = await createCurriculum(request, SUITE_TAG);
        for (let i = 0; i < COUNT; i++) {
            await createSyllabus(request, curriculumId, `${SUITE_TAG}-${i}`);
        }
        await page.goto(`/gantt?gc=${curriculumId}`, { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);
        await page.getByRole("tab", { name: "סילבוסים" }).click();
        await expect(page.getByText(`${SUITE_TAG}-${COUNT - 1}`)).toBeAttached({ timeout: 30_000 });
    });

    test.afterEach(async ({ request }) => {
        await request.delete(`/api/gantt/curriculums/${curriculumId}`);
    });

    test("the card grid has no horizontal overflow", async ({ page }) => {
        const scroller = page.getByTestId("syllabus-cards");
        const { client, scroll } = await scroller.evaluate((el) => ({
            client: el.clientWidth,
            scroll: el.scrollWidth,
        }));
        expect(scroll).toBeLessThanOrEqual(client + 1);
    });

    test("the card grid scrolls vertically", async ({ page }) => {
        const scroller = page.getByTestId("syllabus-cards");
        await expect(scroller).toHaveCSS("overflow-y", "auto");
        await expect(scroller).toHaveCSS("overflow-x", "hidden");
        await expect(scroller).toHaveCSS("flex-direction", "row");
    });

    test("later cards sit below earlier ones, not beside them off-screen", async ({ page }) => {
        const scroller = page.getByTestId("syllabus-cards");
        const box = await scroller.boundingBox();
        // Scoped to the grid: the insights sidebar lists the same names.
        const last = await scroller.getByText(`${SUITE_TAG}-${COUNT - 1}`).first().boundingBox();
        expect(box && last).toBeTruthy();
        // Within the scroller's horizontal span, whatever its vertical position.
        expect(last!.x).toBeGreaterThanOrEqual(box!.x - 1);
        expect(last!.x + last!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
    });

    test("the grid scrolls down, never sideways", async ({ page }) => {
        const scroller = page.getByTestId("syllabus-cards");
        const scrollable = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight);
        test.skip(!scrollable, "all cards fit without scrolling");
        // Scroll the grid itself: the wheel over a card can be taken by the
        // card's own module table.
        await scroller.evaluate((el) => el.scrollBy({ top: 600, left: -600 }));
        await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
    });
});
