import { Page } from "@playwright/test";

import { createSyllabusViaUi, expect, expectNoOpenModal, test, waitForAppLoad } from "./fixtures";
import { createCurriculum } from "./gantt-api";

const NAME = "e2e-new-syllabus";

/**
 * "New syllabus" asks for a name, creates only on confirm (#845), and opens
 * the syllabus it made (#758).
 *
 * Before, a card appeared somewhere in the grid and nothing else happened,
 * so users could not tell a syllabus had been created.
 */

const SUITE_TAG = "e2e-syllabus-create";

async function openSyllabusesTab(page: Page, curriculumId: string): Promise<void> {
    await page.goto(`/gantt?gc=${curriculumId}`, { waitUntil: "commit", timeout: 60_000 });
    await waitForAppLoad(page);
    await page.getByRole("tab", { name: "סילבוסים" }).click();
}

function syllabusDialog(page: Page) {
    return page.getByRole("dialog").filter({ hasText: "עריכת סילבוס" });
}

test.describe("New syllabus opens its dialog (#758)", () => {
    test.describe.configure({ timeout: 90_000 });

    let curriculumId: string;

    test.beforeEach(async ({ page, request }) => {
        curriculumId = await createCurriculum(request, SUITE_TAG);
        await openSyllabusesTab(page, curriculumId);
    });

    test.afterEach(async ({ request }) => {
        await request.delete(`/api/gantt/curriculums/${curriculumId}`);
    });

    test("clicking the button alone creates nothing (#845)", async ({ page, request }) => {
        await page.getByRole("button", { name: "סילבוס חדש" }).click();
        await page.keyboard.press("Escape");
        await expectNoOpenModal(page);
        const response = await request.get(`/api/gantt/curriculums/${curriculumId}`);
        expect(JSON.stringify(await response.json())).not.toContain("סילבוס חדש");
    });

    test("confirming a name opens the syllabus dialog", async ({ page }) => {
        await createSyllabusViaUi(page, NAME);
        await expect(syllabusDialog(page)).toBeVisible({ timeout: 10_000 });
    });

    test("the dialog is for the new syllabus", async ({ page }) => {
        await createSyllabusViaUi(page, NAME);
        await expect(syllabusDialog(page)).toContainText(`עריכת סילבוס: ${NAME}`, { timeout: 10_000 });
    });

    test("the URL carries the real syllabus id, not a temp id", async ({ page }) => {
        await createSyllabusViaUi(page, NAME);
        await expect(syllabusDialog(page)).toBeVisible({ timeout: 10_000 });
        await expect(page).toHaveURL(/[?&]gs=s_/);
        expect(page.url()).not.toContain("temp-");
    });

    test("closing the dialog leaves the new card in place", async ({ page }) => {
        await createSyllabusViaUi(page, NAME);
        await expect(syllabusDialog(page)).toBeVisible({ timeout: 10_000 });
        await page.keyboard.press("Escape");
        await expect(syllabusDialog(page)).toHaveCount(0);
        await expectNoOpenModal(page);
        // The card shows its name in an editable field, which getByText
        // doesn't match, so check the fields' values instead.
        await expect
            .poll(() =>
                page
                    .getByRole("textbox", { name: /שם הסילבוס/ })
                    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
            )
            .toContain(NAME);
    });

    test("the syllabus is persisted, not just shown", async ({ page, request }) => {
        await createSyllabusViaUi(page, NAME);
        await expect(page).toHaveURL(/[?&]gs=s_/, { timeout: 10_000 });
        const syllabusId = new URL(page.url()).searchParams.get("gs");
        const response = await request.get(`/api/gantt/syllabuses/${syllabusId}`);
        expect(response.ok()).toBeTruthy();
    });

    test("a second click opens the second syllabus", async ({ page }) => {
        await createSyllabusViaUi(page, `${NAME}-1`);
        await expect(page).toHaveURL(/[?&]gs=s_/, { timeout: 10_000 });
        const first = new URL(page.url()).searchParams.get("gs");
        await page.keyboard.press("Escape");
        await expect(syllabusDialog(page)).toHaveCount(0);

        await createSyllabusViaUi(page, `${NAME}-2`);
        await expect(syllabusDialog(page)).toBeVisible({ timeout: 10_000 });
        await expect(page).not.toHaveURL(new RegExp(`gs=${first}`));
    });
});
