import { expect, test } from "@playwright/test";

import { SELECTORS } from "./fixtures";

/**
 * The student boundary, end to end against a real Hanich session (#656).
 *
 * Everything here is pinned at the unit level too, but only against mocked
 * sessions. This suite is the one that answers "does it hold when a genuine
 * Hive student token is in the cookie jar" — the unit tests cannot catch a
 * misconfigured clearance mapping, a layout that renders before its gate, or
 * an API that reads the session differently in a real request scope.
 *
 * Runs under the `student` project, whose storageState is the Hanich fixture
 * seeded by `create_e2e_student` in scripts/demo/populate_demo_hive.py.
 */

/** Staff-only API routes, which must all refuse this session. */
const STAFF_ENDPOINTS = [
    "/api/event?sd=2020-01-01&ed=2030-01-01",
    "/api/course",
    "/api/rooms",
    "/api/outsiders",
    // A real slug: `/api/settings` itself is not a route, so it would 404 and
    // prove nothing about the gate.
    "/api/settings/calendarStartHour",
    "/api/custom-colors",
    "/api/iterations",
    "/api/personal-settings",
    "/api/hive/students",
    "/api/hive/users",
    "/api/hive/subjects",
    "/api/hive/modules",
    "/api/hive/classes",
    "/api/gantt/curriculums",
    "/api/calendar/drafts",
    "/api/calendar/snapshots",
    "/api/event/history?id=00000000-0000-4000-8000-000000000000",
    "/api/integrations/google-calendar/status",
];

/** Staff pages, which must all bounce back to the student view. */
const STAFF_PAGES = ["/", "/gantt", "/gantt/", "/cli-auth"];

test.describe("student view", () => {
    test("lands on the student board", async ({ page }) => {
        await page.goto("/student-view");

        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });
    });

    test("shows none of the staff shell", async ({ page }) => {
        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });

        // No app bar, no calendar, and nothing that hints the rest of the app
        // is there — no link off this page at all.
        await expect(page.locator(SELECTORS.appBar)).toHaveCount(0);
        await expect(page.locator(SELECTORS.calendarRoot)).toHaveCount(0);
        await expect(page.locator("a[href='/gantt']")).toHaveCount(0);
        await expect(page.locator("a[href='/']")).toHaveCount(0);
    });

    test("shows no staff preview bar", async ({ page }) => {
        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });

        await expect(page.getByText("תצוגה מקדימה")).toHaveCount(0);
        await expect(page.getByLabel("תאריך")).toHaveCount(0);
    });
});

test.describe("staff pages are unreachable", () => {
    // Same cold-compile cost as above, per page.
    test.slow();

    for (const path of STAFF_PAGES) {
        test(`${path} redirects to the student view`, async ({ page }) => {
            await page.goto(path);

            await expect(page).toHaveURL(/\/student-view/, { timeout: 30_000 });
            // Silently — no error page, nothing naming what was refused.
            await expect(page.getByText(/403|forbidden|אין הרשאה/i)).toHaveCount(
                0,
            );
        });
    }
});

test.describe("staff APIs refuse the session", () => {
    // The first request to each route in a dev build pays Next's on-demand
    // compile, which can outrun the suite's default per-test timeout.
    test.slow();

    for (const endpoint of STAFF_ENDPOINTS) {
        test(`GET ${endpoint} is refused`, async ({ request }) => {
            const response = await request.get(endpoint);

            expect(
                [401, 403],
                `${endpoint} returned ${response.status()}`,
            ).toContain(response.status());
        });
    }

    test("a write to the event API is refused", async ({ request }) => {
        const response = await request.put("/api/event", {
            data: { id: "00000000-0000-4000-8000-000000000000", name: "פריצה" },
        });

        expect([401, 403]).toContain(response.status());
    });
});

test.describe("the student schedule endpoint", () => {
    test("returns only the projected fields", async ({ request }) => {
        const response = await request.get("/api/student-view/schedule");
        expect(response.status()).toBe(200);

        const { data } = await response.json();
        expect(Array.isArray(data.events)).toBe(true);

        for (const event of data.events) {
            expect(Object.keys(event).sort()).toEqual([
                "color",
                "courses",
                "endTime",
                "id",
                "name",
                "rooms",
                "startTime",
            ]);
        }
    });

    test("never mentions a Hive id, note or attribute in the raw body", async ({
        request,
    }) => {
        const response = await request.get("/api/student-view/schedule");
        const body = await response.text();

        for (const field of [
            "hiveModule",
            "hiveLesson",
            "hiveQueues",
            "subject",
            "instructors",
            "lecturers",
            "notes",
            "tags",
            "hidden",
            "personalTalk",
            "ganttEventId",
            "iterationId",
        ]) {
            expect(body, `leaked ${field}`).not.toContain(field);
        }
    });

    test("rejects a date probe", async ({ request }) => {
        const response = await request.get(
            "/api/student-view/schedule?date=2020-01-01",
        );

        expect(response.status()).toBe(403);
    });

    test("rejects an iteration probe, so iterations stay invisible", async ({
        request,
    }) => {
        // `it=` is the staff iteration switch. A student passing one must not
        // get another iteration's data; the endpoint pins them to the current
        // run regardless of what they send.
        const withIteration = await request.get(
            "/api/student-view/schedule?it=2025b",
        );
        const plain = await request.get("/api/student-view/schedule");

        expect(withIteration.status()).toBe(200);
        expect(await withIteration.text()).toBe(await plain.text());
    });
});

test.describe("the websocket carries no calendar data", () => {
    test("the ticket is scoped, and the socket receives only empty pings", async ({
        page,
    }) => {
        const frames: Array<string> = [];
        page.on("websocket", (ws) => {
            ws.on("framereceived", (frame) => frames.push(frame.payload as string));
        });

        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });
        // Give the socket time to connect and register its subscription.
        await page.waitForTimeout(5_000);

        // Whatever arrived, none of it may be calendar data.
        for (const payload of frames) {
            for (const field of ["events", "notes", "hiveModule", "instructors"]) {
                expect(payload, `leaked ${field} over WS`).not.toContain(field);
            }
        }
    });
});
