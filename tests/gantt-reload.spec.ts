import { APIRequestContext } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * End-to-end coverage for the schedule reload ("עדכון הלו״ז לפי הגאנט").
 *
 * Driven through the real HTTP API against the live stack, because the whole
 * point of the feature is the interaction between three stores the unit tests
 * mock away: the Postgres gantt tree, the Mongo schedule, and the Mongo event
 * change log that decides which events a human owns.
 *
 * Flow per test: build a small curriculum → link it to the current iteration →
 * cut → mutate the gantt (and, in the conflict tests, the schedule) → reload
 * and assert what was written.
 */

const SUITE_TAG = "e2e-reload";

type Json = Record<string, unknown>;

/** Unwraps Bluz's `{ status, data }` envelope, failing loudly on an API error. */
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

/** Next Sunday at least a week out, so seeded demo data can't overlap. */
function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

type Fixture = {
    curriculumId: string;
    dayIds: Array<string>;
    eventIds: Array<string>;
    /** Iteration whose gantt link this fixture borrowed, and what it held. */
    iterationId: string;
    moduleId: string;
    previousCurriculumId: null | string;
};

/**
 * Builds a published curriculum holding `titles.length` one-hour events, each
 * mapped to its own day of week 0, and links it to the current iteration.
 */
async function buildCurriculum(
    request: APIRequestContext,
    titles: Array<string>,
): Promise<Fixture> {
    const curriculum = await apiJson<{ id: string }>(
        await request.post("/api/gantt/curriculums", {
            data: {
                description: SUITE_TAG,
                isArchived: false,
                isDraft: false,
                startDate: upcomingSunday(),
                title: `${SUITE_TAG}-${Date.now()}`,
            },
        }),
    );

    // A week is created with its seven days attached. `number` is sent
    // explicitly: the column is NOT NULL with no DB default, so omitting it
    // (as the documented payload suggests) fails the insert.
    await apiJson(
        await request.post("/api/gantt/weeks", {
            data: { curriculumId: curriculum.id, number: 0, weekendDuty: false },
        }),
    );

    const syllabus = await apiJson<{ id: string }>(
        await request.post("/api/gantt/syllabuses", {
            data: {
                curriculumId: curriculum.id,
                hiveIds: [],
                title: `${SUITE_TAG}-syllabus`,
            },
        }),
    );
    const module = await apiJson<{ id: string }>(
        await request.post("/api/gantt/modules", {
            data: {
                description: "",
                hiveIds: [],
                syllabusId: syllabus.id,
                title: `${SUITE_TAG}-module`,
            },
        }),
    );

    const eventIds: Array<string> = [];
    for (const title of titles) {
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
                    title,
                    type: "הרצאה",
                },
            }),
        );
        eventIds.push(event.id);

        // The planner reads the duration allocated *for this curriculum*.
        await apiJson(
            await request.post(
                `/api/gantt/events/${event.id}/allocate-time`,
                { data: { containerId: curriculum.id, duration: 60 } },
            ),
        );
    }

    const tree = await apiJson<{
        c2w: Array<{ week: { w2d: Array<{ day: { dayIndex: number; id: string } }> } }>;
    }>(await request.get(`/api/gantt/curriculums/${curriculum.id}`));
    const dayIds = tree.c2w[0].week.w2d
        .sort((a, b) => a.day.dayIndex - b.day.dayIndex)
        .map((link) => link.day.id);

    for (const [index, eventId] of eventIds.entries()) {
        await apiJson(
            await request.post(
                `/api/gantt/curriculums/${curriculum.id}/mappings`,
                {
                    data: {
                        dayId: dayIds[index],
                        eventId,
                        moduleId: module.id,
                        sortOrder: 0,
                    },
                },
            ),
        );
    }

    const iteration = await apiJson<{
        ganttCurriculumId: null | string;
        id: string;
    }>(await request.get("/api/iterations/current"));
    await apiJson(
        await request.patch(`/api/iterations/${iteration.id}`, {
            data: { ganttCurriculumId: curriculum.id },
        }),
    );

    return {
        curriculumId: curriculum.id,
        dayIds,
        eventIds,
        iterationId: iteration.id,
        moduleId: module.id,
        previousCurriculumId: iteration.ganttCurriculumId ?? null,
    };
}

/**
 * Pulls the cut back, deletes the curriculum and restores the iteration's
 * original gantt link, so the suite leaves the stack exactly as it found it.
 */
async function teardown(
    request: APIRequestContext,
    fixture: Fixture,
): Promise<void> {
    await request.delete(`/api/gantt/curriculums/${fixture.curriculumId}/cut`);
    await request.patch(`/api/iterations/${fixture.iterationId}`, {
        data: { ganttCurriculumId: fixture.previousCurriculumId },
    });
    await request.delete(`/api/gantt/curriculums/${fixture.curriculumId}`);
}

/** The live schedule events this curriculum's cut produced, by gantt event. */
async function cutEvents(
    request: APIRequestContext,
    ganttEventIds: Array<string>,
): Promise<Array<Json>> {
    // The range read caps at 366 days; the fixture's week always lands inside
    // this window (it starts a fortnight out).
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 120);

    const events = await apiJson<Array<Json>>(
        await request.get("/api/event", {
            params: { ed: end.toISOString(), sd: start.toISOString() },
        }),
    );
    // The range read hands back raw Mongo documents; `_id` is immutable, so a
    // write path that echoes a read must drop it (the UI never sees it).
    return events
        .filter((event) => ganttEventIds.includes(event.ganttEventId as string))
        .map(({ _id: _ignored, ...event }) => event);
}

type ReloadResult = {
    addedEvents: number;
    applied: boolean;
    diff: {
        additions: Array<Json>;
        conflicts: Array<{
            eventId: string;
            kind: string;
            lastManualEdit: null | { actorName: null | string; initiator: string };
            title: string;
        }>;
        removals: Array<Json>;
        unchanged: number;
        updates: Array<Json>;
    };
    removedEvents: number;
    skippedConflicts: number;
    updatedEvents: number;
};

async function reload(
    request: APIRequestContext,
    curriculumId: string,
    body: Json = {},
): Promise<ReloadResult> {
    return await apiJson<ReloadResult>(
        await request.patch(`/api/gantt/curriculums/${curriculumId}/cut`, {
            data: body,
        }),
    );
}

test.describe.configure({ mode: "serial" });

test.describe("Gantt → schedule reload", () => {
    test("rejects a reload of a curriculum that was never cut", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A"]);
        try {
            // The reload looks at every live cut event in the linked
            // iteration (that is how it finds events orphaned by a deleted
            // gantt event), so "never cut" has to mean the iteration itself
            // holds nothing — clear any residue from an interrupted run.
            await request.delete(
                `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
            );

            const response = await request.patch(
                `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                { data: {} },
            );
            expect(response.status()).toBe(409);
            expect((await response.json()).error.code).toBe("not-cut");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("adds, retimes and removes occurrences to match the current gantt", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A", "B"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );
            const afterCut = await cutEvents(request, fixture.eventIds);
            expect(afterCut).toHaveLength(2);

            // Gantt changes: rename A (the schedule name is gantt-owned),
            // delete B so its occurrence disappears, and add a third event.
            // B is *deleted*, not just unmapped: an event left in the tree
            // with no day mapping fails the planner outright (`invalid-plan`),
            // which is a different feature's gate.
            await apiJson(
                await request.patch(
                    `/api/gantt/events/${fixture.eventIds[0]}`,
                    { data: { title: "A-renamed" } },
                ),
            );

            await apiJson(
                await request.delete(
                    `/api/gantt/events/${fixture.eventIds[1]}`,
                ),
            );

            const newEvent = await apiJson<{ id: string }>(
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
                        moduleId: fixture.moduleId,
                        orchestratorId: null,
                        recommendedLecturerIds: [],
                        recurrence: "none",
                        roomRequirement: "בחוץ",
                        splitAcrossBreaks: false,
                        systemRequirements: [],
                        title: "C",
                        type: "הרצאה",
                    },
                }),
            );
            await apiJson(
                await request.post(
                    `/api/gantt/events/${newEvent.id}/allocate-time`,
                    { data: { containerId: fixture.curriculumId, duration: 60 } },
                ),
            );
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/mappings`,
                    {
                        data: {
                            dayId: fixture.dayIds[2],
                            eventId: newEvent.id,
                            moduleId: fixture.moduleId,
                            sortOrder: 0,
                        },
                    },
                ),
            );

            const result = await reload(request, fixture.curriculumId);

            expect(result.applied).toBe(true);
            expect(result.addedEvents).toBe(1);
            expect(result.updatedEvents).toBe(1);
            expect(result.removedEvents).toBe(1);
            expect(result.skippedConflicts).toBe(0);

            const live = await cutEvents(request, [
                ...fixture.eventIds,
                newEvent.id,
            ]);
            const names = live.map((event) => event.name);
            expect(names).toContain("A-renamed");
            expect(names).toContain("C");
            expect(names).not.toContain("B");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("an unfinished gantt blocks the reload until it is forced", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );

            // A new event nobody scheduled yet — the same "unfinished gantt"
            // state the cut lets the user push past.
            const unmapped = await apiJson<{ id: string }>(
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
                        moduleId: fixture.moduleId,
                        orchestratorId: null,
                        recommendedLecturerIds: [],
                        recurrence: "none",
                        roomRequirement: "בחוץ",
                        splitAcrossBreaks: false,
                        systemRequirements: [],
                        title: "לא משובץ",
                        type: "הרצאה",
                    },
                }),
            );
            await apiJson(
                await request.post(
                    `/api/gantt/events/${unmapped.id}/allocate-time`,
                    { data: { containerId: fixture.curriculumId, duration: 60 } },
                ),
            );

            const blocked = await request.patch(
                `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                { data: {} },
            );
            expect(blocked.status()).toBe(400);
            const error = (await blocked.json()).error;
            expect(error.code).toBe("invalid-plan");
            expect(error.errors[0]).toMatchObject({
                eventId: unmapped.id,
                type: "unmapped-event",
            });

            // Forced: the unmapped event is skipped, everything else updates.
            const forced = await reload(request, fixture.curriculumId, {
                force: true,
            });
            expect(forced.applied).toBe(true);

            const live = await cutEvents(request, [
                ...fixture.eventIds,
                unmapped.id,
            ]);
            expect(live.map((event) => event.ganttEventId)).not.toContain(
                unmapped.id,
            );
        } finally {
            await teardown(request, fixture);
        }
    });

    test("a second reload with no gantt change is a no-op", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );

            const result = await reload(request, fixture.curriculumId);
            expect(result).toMatchObject({
                addedEvents: 0,
                removedEvents: 0,
                skippedConflicts: 0,
                updatedEvents: 0,
            });
            // Every curriculum also carries the auto-seeded meal/break module,
            // so the unchanged count covers those occurrences too — what
            // matters is that nothing was written.
            expect(result.diff.unchanged).toBeGreaterThanOrEqual(1);
            expect(result.diff.conflicts).toEqual([]);
        } finally {
            await teardown(request, fixture);
        }
    });

    test("a dry run reports the diff and writes nothing", async ({ request }) => {
        const fixture = await buildCurriculum(request, ["A"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );
            await apiJson(
                await request.patch(
                    `/api/gantt/events/${fixture.eventIds[0]}`,
                    { data: { title: "A-dry" } },
                ),
            );

            const preview = await reload(request, fixture.curriculumId, {
                dryRun: true,
            });
            expect(preview.applied).toBe(false);
            expect(preview.diff.updates).toHaveLength(1);
            expect(preview.updatedEvents).toBe(0);

            const live = await cutEvents(request, fixture.eventIds);
            expect(live[0].name).toBe("A");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("a manually edited event is skipped and reported as a conflict", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A", "B"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );
            const live = await cutEvents(request, fixture.eventIds);
            const editedEvent = live.find(
                (event) => event.ganttEventId === fixture.eventIds[0],
            )!;

            // Human edit through the normal write path, declaring the action.
            await apiJson(
                await request.post("/api/event", {
                    data: { ...editedEvent, notes: "נערך ידנית" },
                    headers: { "x-bluz-event-initiator": "event-dialog" },
                }),
            );

            // Gantt moves both events to new times.
            for (const eventId of fixture.eventIds) {
                await apiJson(
                    await request.patch(`/api/gantt/events/${eventId}`, {
                        data: { title: `${eventId.slice(-4)}-moved` },
                    }),
                );
            }

            const result = await reload(request, fixture.curriculumId);

            expect(result.skippedConflicts).toBe(1);
            expect(result.updatedEvents).toBe(1); // only the untouched event
            const conflict = result.diff.conflicts[0];
            expect(conflict.eventId).toBe(editedEvent.id);
            expect(conflict.kind).toBe("update");
            expect(conflict.lastManualEdit?.initiator).toBe("event-dialog");
            expect(conflict.lastManualEdit?.actorName).toBeTruthy();

            // The edited event kept both its manual note and its old name.
            const after = await cutEvents(request, fixture.eventIds);
            const stillEdited = after.find(
                (event) => event.id === editedEvent.id,
            )!;
            expect(stillEdited.notes).toBe("נערך ידנית");
            expect(stillEdited.name).toBe("A");
        } finally {
            await teardown(request, fixture);
        }
    });

    test("an overridden conflict takes the gantt version", async ({
        request,
    }) => {
        const fixture = await buildCurriculum(request, ["A"]);
        try {
            await apiJson(
                await request.post(
                    `/api/gantt/curriculums/${fixture.curriculumId}/cut`,
                    { data: {} },
                ),
            );
            const [cutEvent] = await cutEvents(request, fixture.eventIds);

            await apiJson(
                await request.post("/api/event", {
                    data: { ...cutEvent, notes: "ידני" },
                    headers: { "x-bluz-event-initiator": "drag-drop" },
                }),
            );
            await apiJson(
                await request.patch(
                    `/api/gantt/events/${fixture.eventIds[0]}`,
                    { data: { title: "A-forced" } },
                ),
            );

            const skipped = await reload(request, fixture.curriculumId);
            expect(skipped.skippedConflicts).toBe(1);

            const forced = await reload(request, fixture.curriculumId, {
                overrideEventIds: [cutEvent.id],
            });
            expect(forced.skippedConflicts).toBe(0);
            expect(forced.updatedEvents).toBe(1);

            const [after] = await cutEvents(request, fixture.eventIds);
            expect(after.name).toBe("A-forced");
            // `notes` mirrors the gantt event's comment, so an override resets
            // it — that is the point of taking the gantt version.
            expect(after.notes).toBe("");
            // Schedule-only data the cut never wrote is still untouched.
            expect(after.rooms).toEqual([]);
        } finally {
            await teardown(request, fixture);
        }
    });
});
