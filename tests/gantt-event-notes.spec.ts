import { expect, test, waitForAppLoad } from "./fixtures";
import { createCurriculum, createEvent, createModule, createSyllabus } from "./gantt-api";

/**
 * #773: an event's note is visible without opening the event dialog — a note
 * icon beside the title shows the text on hover.
 */
test.describe("Gantt event note preview", () => {
    test.describe.configure({ timeout: 90_000 });

    test("module dialog shows a hoverable note icon only for events with a note", async ({ page, request }) => {
        const curriculumId = await createCurriculum(request, "e2e-note");
        const syllabusId = await createSyllabus(request, curriculumId);
        const moduleId = await createModule(request, syllabusId, "e2e-note-module");
        const note = `להביא מקרן ${Date.now()}`;
        await createEvent(request, moduleId, "עם הערה", { comment: note });
        await createEvent(request, moduleId, "בלי הערה");

        await page.goto(`/gantt?gc=${curriculumId}&gm=${moduleId}`, { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);

        const dialog = page.getByRole("dialog").filter({ hasText: "e2e-note-module" });
        await expect(dialog).toBeVisible({ timeout: 30_000 });

        const icons = dialog.getByTestId("event-note-indicator");
        await expect(icons).toHaveCount(1);

        await icons.hover();
        await expect(page.getByRole("tooltip")).toContainText(note);
    });
});