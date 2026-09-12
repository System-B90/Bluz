import { APIRequestContext, request as playwrightRequest } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * End-to-end proof of the Bluz→Hive lesson integration, against a real Hive
 * instance with real students.
 *
 * The unit tests cover the decisions; this covers the claim the feature
 * actually makes: a Segel schedules an exercise in Bluz, and when its start
 * time arrives the students of each shuffle are working on the queue that was
 * chosen for them — with nobody pressing anything in between.
 *
 * The whole chain is exercised: the lesson and its per-group rules are created
 * in Hive at save time with the Segel's credentials, and the activator running
 * inside the Bluz server assigns the lesson when the event goes live using the
 * HIVE_API_* service account.
 */

const HIVE_URL = process.env.NEXT_PUBLIC_HIVE_URL ?? "https://hive.test";
const HIVE_USERNAME = process.env.HIVE_API_USERNAME ?? "api";
const HIVE_PASSWORD = process.env.HIVE_API_PASSWORD ?? "Password1";

/**
 * Fixtures are created as an admin: the demo seed builds rooms, not student
 * groups ("shuffles"), and no students at all, so the test provides its own
 * rather than depending on whatever a given Hive happens to hold.
 */
const HIVE_ADMIN_USERNAME = process.env.HIVE_ADMIN_USERNAME ?? "admin";
const HIVE_ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD ?? "Password1";

/** The activator ticks every 30s; allow two ticks plus Hive round-trips. */
const ACTIVATION_TIMEOUT_MS = 100_000;
const POLL_INTERVAL_MS = 2_000;

type HiveContext = { api: APIRequestContext; token: string };

async function loginToHive(
    username: string,
    password: string,
    hint = "",
): Promise<HiveContext> {
    const api = await playwrightRequest.newContext({
        baseURL: HIVE_URL,
        ignoreHTTPSErrors: true,
    });

    const response = await api.post("/api/core/token/", {
        data: { password, username },
    });
    expect(
        response.ok(),
        `Hive rejected ${username} (${response.status()}). ${hint}`,
    ).toBeTruthy();

    const { access } = await response.json();
    return { api, token: access };
}

function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
}

async function hiveGet<T>(
    hive: HiveContext,
    path: string,
): Promise<T> {
    const response = await hive.api.get(path, { headers: authed(hive.token) });
    expect(response.ok(), `GET ${path} → ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
}

/** Polls until `check` returns a value, or fails with `message`. */
async function waitFor<T>(
    check: () => Promise<T | undefined>,
    // Built only on failure: a diagnostic that runs an activation pass would
    // otherwise do the very work the test is waiting for the timer to do.
    message: (() => Promise<string> | string) | string,
    timeoutMs = ACTIVATION_TIMEOUT_MS,
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T | undefined;
    while (Date.now() < deadline) {
        last = await check();
        if (last !== undefined) return last;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    const text = typeof message === "string" ? message : await message();
    throw new Error(`${text} (waited ${timeoutMs}ms)`);
}

test.describe("Hive lesson + queue integration", () => {
    test("an event going live puts its shuffle's students on the chosen queue", async ({
        request,
    }) => {
        test.setTimeout(240_000);

        // The service account the activator itself uses — proving these
        // credentials work is part of what this test is for.
        const hive = await loginToHive(
            HIVE_USERNAME,
            HIVE_PASSWORD,
            "The activator uses these same credentials — if this fails, queues never open in production either.",
        );
        const admin = await loginToHive(
            HIVE_ADMIN_USERNAME,
            HIVE_ADMIN_PASSWORD,
            "Fixtures (student group, student) need an admin.",
        );
        const stamp = Date.now();

        const programs = await hiveGet<Array<any>>(
            hive,
            "/api/core/course/programs/",
        );
        expect(programs.length, "Hive has no program to attach a group to").toBeGreaterThan(0);
        const program = programs[0];

        // ─── A student group ("shuffle") with a real student in it ─────────
        const groupResponse = await admin.api.post(
            "/api/core/management/classes/",
            {
                data: {
                    name: `e2e-שיבוץ-${stamp}`,
                    program: program.id,
                    type: "Student Group",
                    users: [],
                },
                headers: authed(admin.token),
            },
        );
        expect(
            groupResponse.ok(),
            `Creating the student group failed: ${groupResponse.status()} ${await groupResponse.text()}`,
        ).toBeTruthy();
        const group = await groupResponse.json();

        const studentResponse = await admin.api.post(
            "/api/core/management/users/",
            {
                data: {
                    classes: [group.id],
                    clearance: 1,
                    first_name: "E2E",
                    gender: "Male",
                    last_name: "Student",
                    mentees: [],
                    number: Number(String(stamp).slice(-6)),
                    password: "Password1",
                    program: program.id,
                    status: "Present",
                    username: `e2e-hanich-${stamp}`,
                },
                headers: authed(admin.token),
            },
        );
        expect(
            studentResponse.ok(),
            `Creating the student failed: ${studentResponse.status()} ${await studentResponse.text()}`,
        ).toBeTruthy();
        const student = await studentResponse.json();

        // ─── A module of its own, so the queue we assert on is unambiguous ──
        const modules = await hiveGet<Array<any>>(hive, "/api/core/course/modules/");
        const module = modules[0];
        expect(module, "Hive has no modules to hang a lesson on.").toBeTruthy();

        const queueResponse = await admin.api.post("/api/core/queues/", {
            // `user: null` is required explicitly: a queue belongs to either a
            // module or a user, and only module queues may back a lesson rule.
            data: { module: module.id, name: `bluz-e2e-${stamp}`, user: null },
            headers: authed(admin.token),
        });
        expect(
            queueResponse.ok(),
            `Creating the test queue failed: ${queueResponse.status()} ${await queueResponse.text()}`,
        ).toBeTruthy();
        const queue = await queueResponse.json();

        // Remember what the student was on, to prove the change came from us.
        const before = await hiveGet<any>(
            hive,
            `/api/core/management/users/${student.id}/`,
        );
        expect(
            before.queue,
            "The student is already on the queue under test — pick a fresh queue.",
        ).not.toBe(queue.id);

        // ─── Bluz: a course (shuffle) named exactly like the Hive group ────
        // Bluz wraps every payload as { status, data }.
        const courses: Array<any> = await request
            .get("/api/course")
            .then((r) => r.json())
            .then((body) => body.data ?? body);
        let course = courses.find((c) => c.name === group.name);
        let createdCourse = false;
        if (!course) {
            course = {
                color: null,
                description: "e2e — Hive queue integration",
                id: `course-${crypto.randomUUID()}`,
                name: group.name,
            };
            const created = await request.put("/api/course", { data: course });
            expect(created.ok(), "Creating the Bluz course failed").toBeTruthy();
            createdCourse = true;
        }

        // ─── Bluz: an event that is live right now ─────────────────────────
        const eventId = crypto.randomUUID();
        const startTime = new Date(Date.now() - 5_000);
        const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const createEvent = await request.put("/api/event", {
            data: {
                courses: [course.id],
                endTime: endTime.toISOString(),
                hidden: false,
                hiveLesson: null,
                hiveModule: module.id,
                hiveQueues: { [course.id]: queue.id },
                id: eventId,
                instructors: [],
                lecturers: [],
                locked: false,
                name: `e2e תרגול ${stamp}`,
                notes: "",
                personalTalk: false,
                required: false,
                rooms: [],
                splitAcrossBreaks: false,
                startTime: startTime.toISOString(),
                subject: module.parent_subject ?? module.subject_id ?? null,
                tags: [],
                type: 'ע"ע',
            },
        });
        expect(createEvent.ok(), "Creating the Bluz event failed").toBeTruthy();

        try {
            // ─── The lesson and its rules must appear in Hive ──────────────
            const lesson = await waitFor(
                async () => {
                    const lessons = await hiveGet<Array<any>>(
                        hive,
                        `/api/core/schedule/lessons/?module__id=${module.id}`,
                    );
                    return lessons.find((candidate) =>
                        (candidate.description ?? "").startsWith(
                            `bluz-event:${eventId}`,
                        ),
                    );
                },
                "Bluz never created the Hive lesson for the event",
                30_000,
            );

            const rules = await hiveGet<Array<any>>(
                hive,
                `/api/core/schedule/lessons/${lesson.id}/rules/`,
            );
            expect(
                rules,
                "The lesson has no rule for the shuffle — no student would get a queue",
            ).toHaveLength(1);
            expect(rules[0].student_groups).toEqual([group.id]);
            expect(rules[0].queue).toBe(queue.id);

            // ─── The real assertion: the student is moved onto the queue ───
            // The background timer is what must do this; the diagnostic pass
            // below is only read when the wait fails, to say why.
            await waitFor(
                async () => {
                    const current = await hiveGet<any>(
                        hive,
                        `/api/core/management/users/${student.id}/`,
                    );
                    return current.queue === queue.id ? current : undefined;
                },
                async () =>
                    `Student ${student.username} was never put on queue ${queue.id} after the event went live. Diagnostic pass: ${await request
                        .post("/api/hive/lesson-activation")
                        .then((r) => r.text())
                        .catch((error) => String(error))}`,
            );

            // The change is the one Bluz asked for, and nothing else about
            // the student's queueing was disturbed. (Hive's Class serializer
            // does not expose the group's current lesson, so the student is
            // where this is observable — which is also what actually matters.)
            const after = await hiveGet<any>(
                hive,
                `/api/core/management/users/${student.id}/`,
            );
            expect(after.queue).not.toBe(before.queue);
            expect(after.override_queue ?? null).toBe(
                before.override_queue ?? null,
            );

            // ─── Removing the mapping withdraws the lesson from Hive ───────
            const clearMapping = await request.post("/api/event", {
                data: {
                    courses: [course.id],
                    endTime: endTime.toISOString(),
                    hidden: false,
                    hiveLesson: lesson.id,
                    hiveModule: module.id,
                    hiveQueues: {},
                    id: eventId,
                    instructors: [],
                    lecturers: [],
                    locked: false,
                    name: `e2e תרגול ${stamp}`,
                    notes: "",
                    personalTalk: false,
                    required: false,
                    rooms: [],
                    splitAcrossBreaks: false,
                    startTime: startTime.toISOString(),
                    subject: module.parent_subject ?? null,
                    tags: [],
                    type: 'ע"ע',
                },
            });
            expect(clearMapping.ok()).toBeTruthy();

            await waitFor(
                async () => {
                    const lessons = await hiveGet<Array<any>>(
                        hive,
                        `/api/core/schedule/lessons/?module__id=${module.id}`,
                    );
                    const stillThere = lessons.some(
                        (candidate) => candidate.id === lesson.id,
                    );
                    return stillThere ? undefined : true;
                },
                "Clearing the queue mapping did not remove the Hive lesson",
                30_000,
            );
        } finally {
            // A bare string body is sent as raw text; retry JSON-encoded so a
            // rejected delete never leaks fixtures into the next run.
            const deleteJson = async (url: string, id: string) => {
                const first = await request.delete(url, { data: id });
                if (!first.ok()) {
                    await request.delete(url, { data: JSON.stringify(id) });
                }
            };
            await deleteJson("/api/event", eventId);
            if (createdCourse) await deleteJson("/api/course", course.id);

            for (const path of [
                `/api/core/management/users/${student.id}/`,
                `/api/core/management/classes/${group.id}/`,
                `/api/core/queues/${queue.id}/`,
            ]) {
                await admin.api
                    .delete(path, { headers: authed(admin.token) })
                    .catch(() => undefined);
            }

            await hive.api.dispose();
            await admin.api.dispose();
        }
    });
});
