import { Page } from "@playwright/test";

import { expect, test, waitForAppLoad } from "./fixtures";
import { createCurriculum, createEvent, createModule, createSyllabus } from "./gantt-api";

/**
 * Gantt dialog accessibility and safety from the UX review (#834–#838).
 * Each test builds its own draft curriculum, so nothing touches seeded data.
 */

const TAG = "e2e-dialogs-a11y";

type Fixture = {
    curriculumId: string;
    syllabusId: string;
    moduleId: string;
    eventId: string;
    eventTitle: string;
};

async function buildFixture(request: Parameters<typeof createCurriculum>[0]): Promise<Fixture> {
    const stamp = Date.now();
    const curriculumId = await createCurriculum(request, TAG);
    const syllabusId = await createSyllabus(request, curriculumId, `${TAG}-syllabus-${stamp}`);
    const moduleId = await createModule(request, syllabusId, `${TAG}-module-${stamp}`);
    const eventTitle = `${TAG}-event-${stamp}`;
    const eventId = await createEvent(request, moduleId, eventTitle);
    return { curriculumId, syllabusId, moduleId, eventId, eventTitle };
}

async function gotoGantt(page: Page, query: string): Promise<void> {
    await page.goto(`/gantt?${query}`, { waitUntil: "commit", timeout: 60_000 });
    await waitForAppLoad(page);
}

test.describe("Gantt dialogs a11y", () => {
    test.describe.configure({ timeout: 90_000 });

    test("only the top dialog shows a delete, named for its level (#834)", async ({ page, request }) => {
        const f = await buildFixture(request);
        await gotoGantt(page, `gc=${f.curriculumId}&ge=${f.eventId}`);

        const eventDelete = page.getByRole("button", { name: "מחיקת המופע", exact: true });
        await expect(eventDelete).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("button", { name: "מחיקת המערך", exact: true })).toHaveCount(0);

        await page.keyboard.press("Escape");
        await expect(eventDelete).toHaveCount(0);
        await expect(page.getByRole("button", { name: "מחיקת המערך", exact: true })).toBeVisible();
    });

    test("syllabus dialog: autosave status and the unlink button's name (#836, #837)", async ({ page, request }) => {
        const f = await buildFixture(request);
        await gotoGantt(page, `gc=${f.curriculumId}&gs=${f.syllabusId}`);

        const unlink = page.getByRole("button", { name: "הסרה מהגאנט", exact: true });
        await expect(unlink).toBeVisible({ timeout: 30_000 });
        await expect(unlink).toHaveAccessibleDescription(/הסילבוס יישאר במערכת/);

        const title = page.getByRole("textbox", { name: "שם הסילבוס" });
        await title.fill(`${TAG}-renamed-${Date.now()}`);
        await title.blur();
        await expect(page.getByTestId("save-status")).toHaveText("נשמר", { timeout: 15_000 });
    });

    test("event rows in the module dialog have Hebrew, per-event names (#835)", async ({ page, request }) => {
        const f = await buildFixture(request);
        await gotoGantt(page, `gc=${f.curriculumId}&gs=${f.syllabusId}&gm=${f.moduleId}`);

        const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "מחיקת המערך" }) });
        await expect(dialog.getByRole("textbox", { name: `שם — ${f.eventTitle}` })).toBeVisible({ timeout: 30_000 });
        await expect(dialog.getByRole("combobox", { name: `סוג — ${f.eventTitle}` })).toBeVisible();
        await expect(dialog.getByRole("button", { name: `מחיקת "${f.eventTitle}"` })).toBeVisible();
        await expect(dialog.getByRole("button", { name: `הגדלה — משך מינימלי — ${f.eventTitle}` })).toBeVisible();
        await expect(dialog.getByRole("button", { name: /Increase|Decrease/ })).toHaveCount(0);

        const minutes = dialog.getByRole("textbox", { name: `משך מינימלי — ${f.eventTitle}` });
        const box = await minutes.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
    });
});
