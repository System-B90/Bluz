import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reloadCurriculumSchedule } from "@/api-client/gantt/cut";
import { ClientApiError } from "@/api-shared/errors";
import {
    CurriculumReloadError,
    isCurriculumReloadErrorPayload,
} from "@/api-shared/types/gantt/reload";

/**
 * Client wrapper for the schedule reload: request shape, and the typed error
 * the dialog switches on.
 */

function mockFetch(jsonBody: unknown) {
    return vi.fn(async () => ({
        json: async () => jsonBody,
        redirected: false,
    }));
}

const emptyDiff = {
    additions: [],
    conflicts: [],
    removals: [],
    unchanged: 0,
    updates: [],
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("reloadCurriculumSchedule (client)", () => {
    it("PATCHes the cut endpoint and returns the summary", async () => {
        const fetchMock = mockFetch({
            data: {
                addedEvents: 2,
                applied: true,
                createdCourses: [],
                diff: emptyDiff,
                removedEvents: 1,
                skippedConflicts: 0,
                updatedEvents: 3,
            },
            status: 0,
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await reloadCurriculumSchedule("c1");

        expect(result).toMatchObject({
            addedEvents: 2,
            removedEvents: 1,
            updatedEvents: 3,
        });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/gantt/curriculums/c1/cut");
        expect(init.method).toBe("PATCH");
        expect(JSON.parse(init.body as string)).toEqual({});
    });

    it("forwards dry-run, override and force options in the body", async () => {
        const fetchMock = mockFetch({
            data: {
                addedEvents: 0,
                applied: false,
                createdCourses: [],
                diff: emptyDiff,
                removedEvents: 0,
                skippedConflicts: 0,
                updatedEvents: 0,
            },
            status: 0,
        });
        vi.stubGlobal("fetch", fetchMock);

        await reloadCurriculumSchedule("c1", {
            dryRun: true,
            force: true,
            overrideEventIds: ["e1", "e2"],
        });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(init.body as string)).toEqual({
            dryRun: true,
            force: true,
            overrideEventIds: ["e1", "e2"],
        });
    });

    it("throws a typed CurriculumReloadError carrying the coded reason", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                error: { code: "not-cut", message: "לא נגזר" },
                status: -1,
            }),
        );

        try {
            await reloadCurriculumSchedule("c1");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(CurriculumReloadError);
            expect((error as CurriculumReloadError).code).toBe("not-cut");
            expect((error as CurriculumReloadError).message).toBe("לא נגזר");
        }
    });

    it("carries the planner validation errors for an invalid plan", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                error: {
                    code: "invalid-plan",
                    errors: [
                        { eventId: "g1", title: "x", type: "unmapped-event" },
                    ],
                },
                status: -1,
            }),
        );

        try {
            await reloadCurriculumSchedule("c1");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as CurriculumReloadError).errors).toHaveLength(1);
        }
    });
});

describe("isCurriculumReloadErrorPayload", () => {
    it("narrows an error carrying a code", () => {
        const error = Object.assign(new ClientApiError("x"), {
            code: "no-iteration",
        });
        expect(isCurriculumReloadErrorPayload(error)).toBe(true);
    });

    it("rejects a plain client error", () => {
        expect(isCurriculumReloadErrorPayload(new ClientApiError("x"))).toBe(
            false,
        );
    });
});
