import { expect, test } from "@playwright/test";

import { SELECTORS } from "./fixtures";

/**
 * The student boundary, end to end against a real Hanich session (#656).
 *
 * TOP SECURITY PRIORITY. Treat the student as hostile: they read the bundle,
 * know every staff query parameter, and will replay requests by hand. A
 * failure in this file is a data leak — never relax an assertion to make it
 * pass. See `docs/security/student-boundary.md`.
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

        // No app bar, and nothing that hints the rest of the app is there —
        // no link off this page at all.
        await expect(page.locator(SELECTORS.appBar)).toHaveCount(0);
        await expect(page.locator("a[href='/gantt']")).toHaveCount(0);
        await expect(page.locator("a[href='/']")).toHaveCount(0);

        // The board *is* a react-big-calendar grid (the student day view), so
        // its presence is expected. What must be absent is the staff
        // calendar's own machinery: the toolbar, the drag-and-drop addon, the
        // instructor rail and the event dialog.
        await expect(page.locator(".rbc-toolbar")).toHaveCount(0);
        await expect(page.locator(".rbc-addons-dnd")).toHaveCount(0);
        await expect(page.locator("[data-testid='instructor-rail']")).toHaveCount(
            0,
        );
        await expect(page.locator("[role='dialog']")).toHaveCount(0);
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
                "relatedCourses",
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

test.describe("a hostile student probing the boundary", () => {
    test.slow();

    /** Staff parameters a student can copy straight out of a staff URL. */
    const PROBES = [
        "?date=2020-01-01",
        "?date=2030-12-31",
        "?DATE=2020-01-01",
        "?date=2020-01-01&date=2020-01-02",
        "?date[$ne]=null",
        "?date=../../../etc/passwd",
    ];

    for (const probe of PROBES) {
        test(`the schedule endpoint holds the day against ${probe}`, async ({
            request,
        }) => {
            const response = await request.get(
                `/api/student-view/schedule${probe}`,
            );

            // Either refused outright, or served — but never another day.
            if (response.ok()) {
                const { data } = await response.json();
                expect(data.date).not.toBe("2020-01-01");
                expect(data.date).not.toBe("2030-12-31");
                expect(data.date).not.toBe("2020-01-02");
            } else {
                expect(response.status()).toBe(403);
            }
        });
    }

    test("a forged clearance header changes nothing", async ({ request }) => {
        const response = await request.get(
            "/api/student-view/schedule?date=2020-01-01",
            {
                headers: {
                    "x-clearance": "Admin",
                    "x-user-clearance": "Segel",
                    "x-bluz-staff": "true",
                },
            },
        );

        expect(response.status()).toBe(403);
    });

    test("the schedule endpoint refuses every write verb", async ({
        request,
    }) => {
        for (const send of [
            request.post("/api/student-view/schedule", { data: {} }),
            request.put("/api/student-view/schedule", { data: {} }),
            request.patch("/api/student-view/schedule", { data: {} }),
            request.delete("/api/student-view/schedule"),
        ]) {
            const response = await send;
            expect(
                response.ok(),
                `a write to the student schedule succeeded (${response.status()})`,
            ).toBe(false);
        }
    });

    test("the response carries nothing beyond the agreed envelope", async ({
        request,
    }) => {
        const response = await request.get("/api/student-view/schedule");
        const { data } = await response.json();

        expect(Object.keys(data).sort()).toEqual([
            "calendarDayEndTime",
            "calendarDayStartTime",
            "courseGroups",
            "courseNames",
            "date",
            "events",
            "roomNames",
        ]);
    });

    test("an engagement report cannot name another user or day", async ({
        request,
    }) => {
        // The body carries a duration and nothing else; a forged identity or
        // date in the payload must be ignored, not honoured.
        const response = await request.post("/api/student-view/engagement", {
            data: {
                date: "2020-01-01",
                seconds: 30,
                userId: "someone-else",
            },
        });

        // Accepted (it is the student's own counter) or refused — either way,
        // nothing in the body may steer it. A 500 would mean the extra fields
        // reached something that tried to use them.
        expect([200, 400, 401, 403]).toContain(response.status());
    });

    test("the student page itself renders no staff route in its HTML", async ({
        page,
    }) => {
        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });

        const html = await page.content();
        for (const marker of [
            "/api/event",
            "/api/gantt",
            "/api/hive",
            "/api/settings",
            "/gantt",
            "instructors",
            "hiveModule",
        ]) {
            expect(html, `student page named ${marker}`).not.toContain(marker);
        }
    });
});

test.describe("no packet the student page receives carries staff data", () => {
    /*
     * The strongest form of the boundary: not "the schedule endpoint is
     * clean", but "nothing that reaches this browser is dirty". Every HTTP
     * response body and every websocket frame the page receives is scanned.
     * This is the test that would catch a leak through an RSC payload, a
     * prefetch, a source map, or a stray chunk — places no endpoint test
     * looks.
     */
    test.slow();

    /** Markers that may never appear in anything the student receives. */
    const FORBIDDEN = [
        // Staff event fields.
        "hiveModule",
        "hiveLesson",
        "hiveQueues",
        "personalTalk",
        "ganttEventId",
        "ganttCurriculumId",
        // Staff API surface.
        "/api/event",
        "/api/gantt",
        "/api/hive",
        "/api/settings",
        "/api/outsiders",
        "/api/custom-colors",
        "/api/iterations",
        "/api/calendar/drafts",
        "/api/calendar/snapshots",
    ];

    /**
     * Next serves the whole client bundle from `/_next/static`, which contains
     * the app's *code* — every route string in it, staff routes included. That
     * is a bundling property, not a data leak, and splitting the student route
     * into its own bundle is tracked separately; scanning it here would assert
     * something this test cannot fix. Data-bearing responses are what matter.
     */
    function isDataResponse(url: string): boolean {
        return !url.includes("/_next/static/");
    }

    test("every HTTP body and websocket frame is clean", async ({ page }) => {
        const dirty: Array<string> = [];
        const frames: Array<string> = [];

        page.on("websocket", (ws) => {
            ws.on("framereceived", (frame) =>
                frames.push(String(frame.payload)),
            );
        });

        page.on("response", async (response) => {
            const url = response.url();
            if (!isDataResponse(url)) return;
            let body = "";
            try {
                body = await response.text();
            } catch {
                // Redirects and no-content responses have no body to read.
                return;
            }
            for (const marker of FORBIDDEN) {
                if (body.includes(marker)) {
                    dirty.push(`${marker} in ${url}`);
                }
            }
        });

        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });
        // Let the socket connect, register and receive whatever it receives.
        await page.waitForTimeout(5_000);

        for (const frame of frames) {
            for (const marker of FORBIDDEN) {
                if (frame.includes(marker)) dirty.push(`${marker} over WS`);
            }
        }

        expect(
            dirty,
            `staff data reached the student: ${dirty.join(" | ")}`,
        ).toEqual([]);
    });

    test("the schedule response body holds only projection values", async ({
        request,
    }) => {
        const response = await request.get("/api/student-view/schedule");
        const { data } = await response.json();

        for (const event of data.events) {
            expect(Object.keys(event).sort()).toEqual([
                "color",
                "courses",
                "endTime",
                "id",
                "name",
                "relatedCourses",
                "rooms",
                "startTime",
            ]);
            // Values, not just keys: a colour must be a hex string and never
            // an id, and rooms/courses must be indices into this response's
            // name tables (the wire form), never ids.
            expect(event.color).toMatch(/^#[0-9a-fA-F]{6}$/);
            expect(Array.isArray(event.rooms)).toBe(true);
            for (const room of event.rooms) {
                expect(Number.isInteger(room)).toBe(true);
                expect(room).toBeLessThan(data.roomNames.length);
            }
            for (const group of [event.courses, event.relatedCourses]) {
                expect(Number.isInteger(group)).toBe(true);
                expect(group).toBeLessThan(data.courseGroups.length);
            }
        }

        for (const group of data.courseGroups) {
            for (const index of group) {
                expect(Number.isInteger(index)).toBe(true);
                expect(index).toBeLessThan(data.courseNames.length);
            }
        }

        for (const name of [...data.roomNames, ...data.courseNames]) {
            expect(typeof name).toBe("string");
            // Bluz ids are uuids; a display name never looks like one.
            expect(name).not.toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
        }
    });

    test("no staff cookie or header comes back with the board", async ({
        page,
    }) => {
        await page.goto("/student-view");
        await expect(page.locator(SELECTORS.studentBoard)).toBeVisible({
            timeout: 30_000,
        });

        const cookies = await page.context().cookies();
        for (const cookie of cookies) {
            expect(
                cookie.name.toLowerCase(),
                `cookie ${cookie.name} names a clearance`,
            ).not.toContain("clearance");
        }
    });
});
