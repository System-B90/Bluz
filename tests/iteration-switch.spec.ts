import {
    test,
    expect,
    SELECTORS,
    gotoAppHome,
    openSettingsDialog,
    navigateToSettingsTab,
} from "./fixtures";

/**
 * Iteration switching — data scoping (#554).
 *
 * `settings.spec.ts`'s "switches the active iteration and restores it"
 * covers the PATCH/registry side of a switch (#472), but never checks that
 * the schedule page itself actually shows different data once the active
 * iteration changes — each iteration lives in its own database
 * (`resolveIterationDb` in `ui/src/api-server/mongo-db-controller.ts`), and
 * only the *current* one is writable/readable by default on `/`. This spec
 * seeds an event that exists only in a second iteration and asserts it is
 * visible on the schedule only while that iteration is current, and gone
 * again once the original iteration is restored.
 */

test.describe("Iteration switching — data scoping", () => {
    test.describe.configure({ timeout: 60_000 });

    test("schedule data changes when the active iteration switches", async ({
        page,
        request,
    }) => {
        const tempId = `e2e-scope-${Date.now()}`;
        const tempLabel = `מחזור בדיקה ${tempId}`;
        const eventName = `e2e-scope-event-${tempId}`;

        const before = await request.get("/api/iterations");
        expect(before.ok()).toBeTruthy();
        const originalCurrent = (await before.json()).data.find(
            (iteration: { isCurrent: boolean }) => iteration.isCurrent,
        );
        expect(
            originalCurrent,
            "an iteration must be current to start",
        ).toBeTruthy();

        const created = await request.post("/api/iterations", {
            data: {
                id: tempId,
                label: tempLabel,
                hiveCache: {
                    modules: {},
                    subjects: {},
                    rooms: {},
                    cachedAt: new Date().toISOString(),
                },
            },
        });
        expect(created.ok()).toBeTruthy();

        let eventId: string | undefined;

        try {
            // Promote the new iteration so it becomes writable, then seed an
            // event that only exists in its database.
            await gotoAppHome(page);
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "מחזורים");
            const dialog = page.locator(SELECTORS.settingsDialog).first();
            const row = dialog.locator("li", { hasText: tempLabel }).first();
            await expect(row).toBeVisible();
            await row.getByRole("button", { name: "הפעל" }).click();
            await expect(
                page.getByText(`"${tempLabel}" הוגדר כמחזור הפעיל`),
            ).toBeVisible();

            eventId = crypto.randomUUID();
            const startTime = new Date();
            startTime.setHours(10, 0, 0, 0);
            const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

            const createEvent = await request.put("/api/event", {
                data: {
                    courses: [],
                    endTime: endTime.toISOString(),
                    hidden: false,
                    hiveLesson: null,
                    hiveModule: null,
                    hiveQueues: {},
                    id: eventId,
                    instructors: [],
                    lecturers: [],
                    locked: false,
                    name: eventName,
                    notes: "",
                    personalTalk: false,
                    required: false,
                    rooms: [],
                    splitAcrossBreaks: false,
                    startTime: startTime.toISOString(),
                    subject: null,
                    tags: [],
                    type: 'ע"ע',
                },
            });
            expect(
                createEvent.ok(),
                "creating the scoped event failed",
            ).toBeTruthy();

            // The new iteration is current — the schedule should show the event.
            await gotoAppHome(page);
            await expect(
                page
                    .locator(SELECTORS.calendarEvent)
                    .filter({ hasText: eventName }),
            ).toHaveCount(1, { timeout: 10_000 });

            // Switch back to the original iteration — its database never got
            // this event, so data scoping means it must disappear.
            await openSettingsDialog(page);
            await navigateToSettingsTab(page, "מחזורים");
            const dialog2 = page.locator(SELECTORS.settingsDialog).first();
            const originalRow = dialog2
                .locator("li", {
                    hasText: originalCurrent.label ?? originalCurrent.id,
                })
                .first();
            await originalRow.getByRole("button", { name: "הפעל" }).click();
            await expect(
                page.getByText("הוגדר כמחזור הפעיל", { exact: false }),
            ).toBeVisible();

            await gotoAppHome(page);
            await expect(
                page
                    .locator(SELECTORS.calendarEvent)
                    .filter({ hasText: eventName }),
            ).toHaveCount(0, { timeout: 10_000 });
        } finally {
            // The event is only writable/deletable while its iteration is
            // current, and the temp iteration can't be deleted while it
            // still owns an event — so: re-promote temp, delete the event,
            // restore the original as current, then delete the now-empty
            // temp iteration.
            if (eventId) {
                await request.patch(`/api/iterations/${tempId}`, {
                    data: { isCurrent: true },
                });
                await request
                    .delete("/api/event", { data: JSON.stringify(eventId) })
                    .catch(() => {});
            }
            await request.patch(`/api/iterations/${originalCurrent.id}`, {
                data: { isCurrent: true },
            });
            await request.delete(`/api/iterations/${tempId}`).catch(() => {});
        }
    });
});
