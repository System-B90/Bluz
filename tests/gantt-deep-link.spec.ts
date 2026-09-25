import { APIRequestContext } from "@playwright/test";

import { expect, test, waitForAppLoad } from "./fixtures";

/**
 * The gantt event deep link (`?ge=`, #576).
 *
 * Landing on the link must open the module dialog with the event dialog on
 * top — the same state clicking that event from inside an open module
 * produces — and the param must survive a reload and disappear when the
 * dialog closes. The behaviour was rebuilt four times in a row (deep link
 * highlighting the syllabus only, the module dialog missing behind it, the
 * gc being clobbered, then two params doing one job), with no test pinning
 * any of it.
 */

const SUITE_TAG = "e2e-deep-link";

type Json = Record<string, unknown>;

async function apiJson<T = Json>(
    response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
    const body = await response.json();
    expect(
        body.status,
        `API error: ${JSON.stringify(body.error ?? body)}`,
    ).toBe(0);
    return body.data as T;
}

/** Next Sunday a fortnight out, well clear of the seeded demo data. */
function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

type Fixture = {
    curriculumId: string;
    eventId: string;
    eventTitle: string;
    moduleTitle: string;
};

/** A draft curriculum holding one syllabus → module → event. */
async function buildCurriculum(
    request: APIRequestContext,
): Promise<Fixture> {
    const stamp = Date.now();
    const curriculum = await apiJson<{ id: string }>(
        await request.post("/api/gantt/curriculums", {
            data: {
                description: SUITE_TAG,
                isArchived: false,
                isDraft: true,
                startDate: upcomingSunday(),
                title: `${SUITE_TAG}-${stamp}`,
            },
        }),
    );
    const syllabus = await apiJson<{ id: string }>(
        await request.post("/api/gantt/syllabuses", {
            data: {
                curriculumId: curriculum.id,
                hiveIds: [],
                title: `${SUITE_TAG}-syllabus-${stamp}`,
            },
        }),
    );
    const moduleTitle = `${SUITE_TAG}-module-${stamp}`;
    const module = await apiJson<{ id: string }>(
        await request.post("/api/gantt/modules", {
            data: {
                description: "",
                hiveIds: [],
                syllabusId: syllabus.id,
                title: moduleTitle,
            },
        }),
    );
    const eventTitle = `${SUITE_TAG}-event-${stamp}`;
    const event = await apiJson<{ id: string }>(
        await request.post("/api/gantt/events", {
            data: {
                allocatedDuration: 60,
                comment: null,
                hiveLessonId: null,
                hiveModuleId: null,
                hiveSubjectId: null,
                isCritical: false,
                isPaWindow: false,
                minimumDuration: 60,
                moduleId: module.id,
                orchestratorId: null,
                recommendedLecturerIds: [],
                recurrence: "none",
                roomRequirement: "בחוץ",
                splitAcrossBreaks: false,
                systemRequirements: [],
                title: eventTitle,
                type: "הרצאה",
            },
        }),
    );

    return {
        curriculumId: curriculum.id,
        eventId: event.id,
        eventTitle,
        moduleTitle,
    };
}

async function gotoDeepLink(
    page: import("@playwright/test").Page,
    fixture: Fixture,
    eventId: string = fixture.eventId,
): Promise<void> {
    await page.goto(
        `/gantt?gc=${fixture.curriculumId}&ge=${eventId}`,
        { waitUntil: "commit", timeout: 60_000 },
    );
    await waitForAppLoad(page);
}

test.describe("Gantt event deep link", () => {
    test.describe.configure({ timeout: 90_000 });

    test("opens the event dialog with the module dialog behind it", async ({
        page,
        request,
    }) => {
        const fixture = await buildCurriculum(request);

        await gotoDeepLink(page, fixture);

        // The event dialog is on top; the module dialog is the one behind it.
        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.eventTitle }),
        ).toBeVisible({ timeout: 30_000 });
        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.moduleTitle }),
        ).toBeVisible();
    });

    test("keeps the curriculum and the event id in the URL", async ({
        page,
        request,
    }) => {
        const fixture = await buildCurriculum(request);

        await gotoDeepLink(page, fixture);
        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.eventTitle }),
        ).toBeVisible({ timeout: 30_000 });

        // A clobbered gc was its own regression: the gantt then has no
        // curriculum to load and the link silently does nothing.
        expect(new URL(page.url()).searchParams.get("gc")).toBe(
            fixture.curriculumId,
        );
        expect(new URL(page.url()).searchParams.get("ge")).toBe(
            fixture.eventId,
        );
    });

    test("reopens the same event after a reload", async ({
        page,
        request,
    }) => {
        const fixture = await buildCurriculum(request);

        await gotoDeepLink(page, fixture);
        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.eventTitle }),
        ).toBeVisible({ timeout: 30_000 });

        await page.reload({ waitUntil: "commit" });
        await waitForAppLoad(page);

        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.eventTitle }),
        ).toBeVisible({ timeout: 30_000 });
    });

    // Currently broken: closing the event dialog leaves `?ge=` behind, so the
    // next reload reopens the dialog the user just dismissed. The provider
    // does clear the param with `history.replaceState`, but IterationProvider
    // then issues a `router.replace` built from the URL Next still believes is
    // current, putting `ge` back (it lands alongside the `it=current` backfill
    // in the same tick). Same clobber family as the gc regression this deep
    // link already went through. Unskip with the fix.
    test.fixme("drops ?ge= from the URL when the event dialog is closed", async ({
        page,
        request,
    }) => {
        const fixture = await buildCurriculum(request);

        await gotoDeepLink(page, fixture);
        const eventDialog = page
            .getByRole("dialog")
            .filter({ hasText: fixture.eventTitle });
        await expect(eventDialog).toBeVisible({ timeout: 30_000 });

        await page.keyboard.press("Escape");

        await expect(eventDialog).toBeHidden();
        await expect
            .poll(() => new URL(page.url()).searchParams.get("ge"))
            .toBeNull();
        expect(new URL(page.url()).searchParams.get("gc")).toBe(
            fixture.curriculumId,
        );
    });

    test("opens nothing for an event id the curriculum does not hold", async ({
        page,
        request,
    }) => {
        const fixture = await buildCurriculum(request);

        await gotoDeepLink(page, fixture, "e_does_not_exist");

        await expect(
            page.getByRole("dialog").filter({ hasText: fixture.eventTitle }),
        ).toBeHidden();
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });
});
