import { APIRequestContext, Locator, Page } from "@playwright/test";

import {
    expect,
    test,
    dragDndKit,
    gotoAppHome,
    openSettingsDialog,
    navigateToSettingsTab,
    testId,
} from "./fixtures";

/**
 * Course Builder settings tab (בניית קורסים).
 *
 * Covers the drag-and-drop course hierarchy UI: rendering the tree, creating
 * a root course via the UI button, dragging a course onto another to nest it,
 * and dragging it onto the RootDropZone to un-nest it. Courses used purely as
 * drag targets/setup are provisioned via `/api/course` (see course-collapse.spec.ts)
 * since that's faster/more reliable than clicking through creation for every case;
 * the drag interactions themselves are exercised through the real UI.
 */

type TestCourse = { id: string; name: string; parentId: null | string };

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
        description: "e2e course-builder fixture",
    };
    const response = await request.put("/api/course", { data: course });
    expect(response.ok(), `failed to create course ${name}`).toBeTruthy();
    return course;
}

/**
 * Deletes courses through the API.
 *
 * `request.delete(url, {data: someString})` sends the body as raw text, not
 * JSON — course-collapse.spec.ts's `deleteCourses` passes the bare id that
 * way and the server-side route happens to accept it, but to be safe (and
 * since a 500 here would leak fixtures across runs) we verify with `.ok()`
 * and fall back to a JSON-stringified body if the raw form is rejected.
 */
async function deleteCourses(
    request: APIRequestContext,
    courses: Array<TestCourse>,
): Promise<void> {
    for (const course of [ ...courses ].reverse()) {
        const response = await request.delete("/api/course", { data: course.id });
        if (!response.ok()) {
            await request.delete("/api/course", { data: JSON.stringify(course.id) });
        }
    }
}

async function openCourseBuilderTab(page: Page): Promise<void> {
    await openSettingsDialog(page);
    await navigateToSettingsTab(page, "בניית קורסים");
}

function getCourseCard(page: Page, name: string) {
    return page
        .locator(".course-card-container")
        .filter({ hasText: name })
        .first();
}

/**
 * Drags a course card onto a drop target through dnd-kit (see dragDndKit for
 * why a plain handle-to-target mouse drag missed). Grabs the handle, carries
 * the card's draggable row, and lands it on the target.
 */
async function dragCourseOnto(
    page: Page,
    source: ReturnType<typeof getCourseCard>,
    target: Locator,
): Promise<void> {
    const handle = source.locator("svg").first().locator("..");
    const draggedRow = source.locator(":scope > div").first();
    await dragDndKit(page, handle, draggedRow, target);
}

/** Reads a course's current parent straight from the API. */
async function parentIdOf(
    request: APIRequestContext,
    courseId: string,
): Promise<null | string | undefined> {
    const response = await request.get("/api/course");
    expect(response.ok()).toBeTruthy();
    const list = (await response.json()).data as Array<TestCourse>;
    return list.find((course) => course.id === courseId)?.parentId ?? null;
}
test.describe("Course Builder settings tab", () => {
    // The shared test env accumulates a long tail of leftover course
    // fixtures from other specs (course-collapse.spec.ts etc.), which makes
    // the hierarchy tree and course-picker Autocomplete considerably slower
    // to interact with than a clean environment. Budget generously.
    test.describe.configure({ timeout: 120_000 });

    const suffix = testId("cbuild");
    const courseAName = `בילדר-א-${suffix}`;
    const courseBName = `בילדר-ב-${suffix}`;

    let courses: Array<TestCourse> = [];

    test.beforeEach(async ({ page, playwright, baseURL, storageState }) => {
        const request = await playwright.request.newContext({
            baseURL,
            ignoreHTTPSErrors: true,
            storageState: storageState as string,
        });
        const courseA = await createCourse(request, courseAName);
        const courseB = await createCourse(request, courseBName);
        courses = [ courseA, courseB ];
        await request.dispose();

        await gotoAppHome(page);
    });

    test.afterEach(async ({ playwright, baseURL, storageState }) => {
        const request = await playwright.request.newContext({
            baseURL,
            ignoreHTTPSErrors: true,
            storageState: storageState as string,
        });
        await deleteCourses(request, courses);
        await request.dispose();
    });

    test("renders the hierarchy heading and existing root courses", async ({ page }) => {
        await openCourseBuilderTab(page);

        await expect(
            page.getByText("היררכיית מסלולים ומדריכים", { exact: true }),
        ).toBeVisible();

        await expect(getCourseCard(page, courseAName)).toBeVisible();
        await expect(getCourseCard(page, courseBName)).toBeVisible();
    });

    test("creates a new root course via the UI button", async ({ page }) => {
        await openCourseBuilderTab(page);

        const newCourseCardsBefore = page.locator(".course-card-container").filter({ hasText: "מסלול חדש" });
        const countBefore = await newCourseCardsBefore.count();

        await page.getByRole("button", { name: "יצירת מסלול ראשי חדש" }).click();

        const newCourseCards = page.locator(".course-card-container").filter({ hasText: "מסלול חדש" });
        await expect(newCourseCards).toHaveCount(countBefore + 1, { timeout: 10_000 });

        // Clean up immediately through the UI's own delete control, so this
        // test doesn't leave "מסלול חדש" debris behind for later runs — the
        // delete icon only renders on hover, matching how a real user works.
        const created = newCourseCards.last();
        await created.hover();
        await created.getByRole("button", { name: "מחיקת מסלול" }).click();
        await expect(newCourseCardsBefore).toHaveCount(countBefore, { timeout: 10_000 });
    });

    test("dragging a course onto another nests it as a child, and the RootDropZone un-nests it", async ({
        page,
        request,
    }) => {
        // Asserted through the API, not the rendered tree: the original
        // version's UI checks were loose enough to also match the pre-drag
        // state, so it went green while parentId never changed (#648).
        const [ courseA, courseB ] = courses;
        await openCourseBuilderTab(page);

        const sourceCard = getCourseCard(page, courseAName);
        const targetCard = getCourseCard(page, courseBName);
        await expect(sourceCard).toBeVisible();
        await expect(targetCard).toBeVisible();

        await dragCourseOnto(page, sourceCard, targetCard);
        await expect
            .poll(() => parentIdOf(request, courseA.id), { timeout: 10_000 })
            .toBe(courseB.id);

        // B now has a child, so it grows an expand toggle; open it to reach A.
        await gotoAppHome(page);
        await openCourseBuilderTab(page);
        // B's container wraps A once nested, so A's own card is the one that
        // does not also carry B's name.
        const nestedCard = page
            .locator(".course-card-container")
            .filter({ hasText: courseAName })
            .filter({ hasNotText: courseBName });
        if (await nestedCard.isHidden()) {
            await getCourseCard(page, courseBName).getByRole("button").first().click();
        }
        await expect(nestedCard).toBeVisible({ timeout: 5_000 });

        const rootDropZone = page.getByText("גרור להוצאה מהיררכיה").locator("..");
        await expect(rootDropZone).toBeVisible();
        await dragCourseOnto(page, nestedCard, rootDropZone);
        await expect
            .poll(() => parentIdOf(request, courseA.id), { timeout: 10_000 })
            .toBeNull();
    });
});
