import { APIRequestContext } from "@playwright/test";

import {
    expect,
    test,
    SELECTORS,
    getEventDialog,
    gotoAppHome,
    switchToDayView,
    testId,
} from "./fixtures";

/**
 * Course roll-up on schedule events.
 *
 * A schedule event tags the courses it belongs to. When every child of a course
 * is selected, the event shows the parent instead of the children; when only
 * some children are selected, it shows exactly those children.
 *
 * The tree is provisioned through the `/api/course` endpoint (the settings UI
 * flow for building hierarchies is drag-and-drop, which is far more brittle),
 * then the selection itself is made through the real event dialog.
 */

type TestCourse = { id: string; name: string; parentId: null | string };

/** Creates a course through the API and returns it. */
async function createCourse(
    request: APIRequestContext,
    name: string,
    parentId: null | string = null,
): Promise<TestCourse> {
    const course = {
        id: `course-${crypto.randomUUID()}`,
        name,
        color: null,
        parentId,
        description: "e2e course roll-up fixture",
    };
    const response = await request.put("/api/course", { data: course });
    expect(response.ok(), `failed to create course ${name}`).toBeTruthy();
    return course;
}

async function deleteCourses(
    request: APIRequestContext,
    courses: Array<TestCourse>,
): Promise<void> {
    // Children first — deleting a parent first can orphan its children.
    for (const course of [ ...courses ].reverse()) {
        await request.delete("/api/course", { data: JSON.stringify(course.id) });
    }
}

/** Selects the given course names in the open event dialog's course field. */
async function selectCourses(
    page: Parameters<typeof gotoAppHome>[0],
    names: Array<string>,
): Promise<void> {
    const dialog = getEventDialog(page);
    await dialog
        .locator(".MuiFormControl-root")
        .filter({ hasText: "מסלולים" })
        .getByRole("combobox")
        .click();

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    for (const name of names) {
        await listbox.getByRole("option", { name, exact: true }).click();
    }

    // Closing the Select is what commits the selection (onClose → onBlurCallback).
    await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
}

/**
 * Drag-selects a taller-than-default time range on the calendar to open the
 * event dialog. `fixtures.ts`'s `selectCalendarTimeRange` only spans ~50min,
 * which at the calendar's pixel scale draws a tile just under the 55px
 * threshold `UnifiedEvent` uses to decide whether to render the course row at
 * all (see `size.height >= 55` in UnifiedEvent.tsx) — too short for the
 * course-roll-up assertions in this file to see anything on the tile
 * regardless of whether roll-up itself is working.
 */
async function selectTallCalendarTimeRange(
    page: Parameters<typeof gotoAppHome>[0],
): Promise<void> {
    await switchToDayView(page);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "none";
        });
    });

    const daySlot = page.locator(".rbc-time-content .rbc-day-slot").first();
    await daySlot.scrollIntoViewIfNeeded();

    const box = await daySlot.boundingBox();
    if (!box) {
        throw new Error("Calendar day slot not found");
    }

    const x = box.x + box.width / 2;
    const startY = box.y + box.height * 0.25;
    const endY = box.y + box.height * 0.4;

    await page.mouse.move(x, startY);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.evaluate(() => {
        document.querySelectorAll(".rbc-events-container").forEach((el) => {
            (el as HTMLElement).style.pointerEvents = "";
        });
    });
}

/** Creates an event at a free slot with the given name and course selection. */
async function createEventWithCourses(
    page: Parameters<typeof gotoAppHome>[0],
    eventName: string,
    courseNames: Array<string>,
): Promise<void> {
    await selectTallCalendarTimeRange(page);

    const dialog = getEventDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.locator("input").first().fill(eventName);

    await selectCourses(page, courseNames);

    await dialog.getByRole("button", { name: "שמירה" }).click();
    await expect(dialog).toBeHidden();
}

function getEventTile(page: Parameters<typeof gotoAppHome>[0], name: string) {
    return page
        .locator(SELECTORS.calendarEvent)
        .filter({ hasText: name })
        .first();
}

/** Deletes the named event through its dialog, ignoring an already-gone event. */
async function deleteEvent(
    page: Parameters<typeof gotoAppHome>[0],
    name: string,
): Promise<void> {
    const tile = getEventTile(page, name);
    if (!(await tile.isVisible().catch(() => false))) return;

    await tile.dblclick();
    const dialog = getEventDialog(page);
    await dialog.getByRole("button", { name: "מחיקה" }).click();
    await page.waitForTimeout(500);
}

test.describe("Course roll-up on schedule events", () => {
    // A cold app load plus the hydration retry in event-dialog interactions
    // doesn't fit the suite's global 15s budget (see settings.spec.ts).
    test.describe.configure({ timeout: 60_000 });

    // A tree of: parent ── childA
    //                   └─ childB
    //                   └─ childC
    const suffix = testId("roll");
    const parentName = `הורה-${suffix}`;
    const childNames = [ `בן-א-${suffix}`, `בן-ב-${suffix}`, `בן-ג-${suffix}` ];

    let courses: Array<TestCourse> = [];

    test.beforeAll(async ({ playwright, baseURL, storageState }) => {
        const request = await playwright.request.newContext({
            baseURL,
            ignoreHTTPSErrors: true,
            storageState: storageState as string,
        });
        const parent = await createCourse(request, parentName);
        const children = [];
        for (const name of childNames) {
            children.push(await createCourse(request, name, parent.id));
        }
        courses = [ parent, ...children ];
        await request.dispose();
    });

    test.afterAll(async ({ playwright, baseURL, storageState }) => {
        const request = await playwright.request.newContext({
            baseURL,
            ignoreHTTPSErrors: true,
            storageState: storageState as string,
        });
        await deleteCourses(request, courses);
        await request.dispose();
    });

    test.beforeEach(async ({ page }) => {
        await gotoAppHome(page);
    });

    test("shows the created course tree in the event dialog", async ({
        page,
    }) => {
        await selectTallCalendarTimeRange(page);

        const dialog = getEventDialog(page);
        await expect(dialog).toBeVisible();
        await dialog
            .locator(".MuiFormControl-root")
            .filter({ hasText: "מסלולים" })
            .getByRole("combobox")
            .click();

        const listbox = page.getByRole("listbox");
        await expect(
            listbox.getByRole("option", { name: parentName, exact: true }),
        ).toBeVisible();
        for (const name of childNames) {
            await expect(
                listbox.getByRole("option", { name, exact: true }),
            ).toBeVisible();
        }

        await page.keyboard.press("Escape");
        await dialog.getByRole("button", { name: "ביטול" }).click();
    });

    test("shows a single selected child as itself", async ({ page }) => {
        const eventName = testId("event-one-child");
        try {
            await createEventWithCourses(page, eventName, [ childNames[0] ]);

            const tile = getEventTile(page, eventName);
            await expect(tile).toContainText(childNames[0]);
            await expect(tile).not.toContainText(parentName);
        } finally {
            await deleteEvent(page, eventName);
        }
    });

    test("shows two of three selected children as those two children", async ({
        page,
    }) => {
        const eventName = testId("event-two-children");
        try {
            await createEventWithCourses(page, eventName, [
                childNames[0],
                childNames[1],
            ]);

            const tile = getEventTile(page, eventName);
            await expect(tile).toContainText(childNames[0]);
            await expect(tile).toContainText(childNames[1]);
            await expect(tile).not.toContainText(childNames[2]);
            await expect(tile).not.toContainText(parentName);
        } finally {
            await deleteEvent(page, eventName);
        }
    });

    test("collapses all three selected children into the parent", async ({
        page,
    }) => {
        const eventName = testId("event-all-children");
        try {
            await createEventWithCourses(page, eventName, childNames);

            const tile = getEventTile(page, eventName);
            await expect(tile).toContainText(parentName);
            for (const name of childNames) {
                await expect(tile).not.toContainText(name);
            }
        } finally {
            await deleteEvent(page, eventName);
        }
    });

    test("keeps the parent when the parent itself is selected", async ({
        page,
    }) => {
        const eventName = testId("event-parent");
        try {
            await createEventWithCourses(page, eventName, [ parentName ]);

            const tile = getEventTile(page, eventName);
            await expect(tile).toContainText(parentName);
            for (const name of childNames) {
                await expect(tile).not.toContainText(name);
            }
        } finally {
            await deleteEvent(page, eventName);
        }
    });

    test("keeps the collapsed parent after a page reload", async ({ page }) => {
        const eventName = testId("event-reload");
        try {
            await createEventWithCourses(page, eventName, childNames);
            await gotoAppHome(page);
            await page.getByRole("button", { name: "יום", exact: true }).click();

            const tile = getEventTile(page, eventName);
            await expect(tile).toContainText(parentName);
            await expect(tile).not.toContainText(childNames[0]);
        } finally {
            await deleteEvent(page, eventName);
        }
    });
});
