import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route contract for the reload verb: option parsing off the body and the
 * status code each coded rejection maps to (state conflicts 409, bad plan 400).
 */

vi.mock("@/api-server/gantt/cut", () => ({
    cutCurriculumToSchedule: vi.fn(),
    getCutStatus: vi.fn(),
    pullBackCutSchedule: vi.fn(),
}));
vi.mock("@/api-server/gantt/reload", () => ({
    reloadCurriculumSchedule: vi.fn(),
}));

import { reloadCurriculumSchedule } from "@/api-server/gantt/reload";
import { ApiCurriculumReloadPayload } from "@/api-shared/types/gantt/reload";
import * as CutRoute from "@/app/api/gantt/curriculums/[id]/cut/route";

const context = { params: Promise.resolve({ id: "c1" }) };

function patch(body?: ApiCurriculumReloadPayload): NextRequest {
    return new NextRequest("http://localhost/api/gantt/curriculums/c1/cut", {
        body: body === undefined ? undefined : JSON.stringify(body),
        method: "PATCH",
    });
}

const okResult = {
    addedEvents: 1,
    applied: true,
    createdCourses: [],
    diff: {
        additions: [],
        conflicts: [],
        removals: [],
        unchanged: 0,
        updates: [],
    },
    removedEvents: 0,
    skippedConflicts: 0,
    updatedEvents: 0,
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reloadCurriculumSchedule).mockResolvedValue({
        ok: true,
        result: okResult,
    });
});

describe("PATCH .../cut", () => {
    it("returns the reload summary on success", async () => {
        const response = await CutRoute.PATCH(patch({}), {
            params: Promise.resolve({ id: "c1" }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.addedEvents).toBe(1);
    });

    it("forwards dry-run, force and override ids to the service", async () => {
        await CutRoute.PATCH(
            patch({
                dryRun: true,
                force: true,
                overrideEventIds: ["e1"],
            }),
            { params: Promise.resolve({ id: "c1" }) },
        );

        expect(reloadCurriculumSchedule).toHaveBeenCalledWith("c1", {
            dryRun: true,
            force: true,
            overrideEventIds: ["e1"],
        });
    });

    it("defaults every option when the body is absent", async () => {
        await CutRoute.PATCH(patch(), context);

        expect(reloadCurriculumSchedule).toHaveBeenCalledWith("c1", {
            dryRun: false,
            force: false,
            overrideEventIds: [],
        });
    });

    it.each([
        ["draft", 409],
        ["no-iteration", 409],
        ["not-cut", 409],
        ["invalid-plan", 400],
    ] as const)("maps a %s rejection to %i", async (code, status) => {
        vi.mocked(reloadCurriculumSchedule).mockResolvedValue({
            error: { code, message: "nope" },
            ok: false,
        });

        const response = await CutRoute.PATCH(patch({}), {
            params: Promise.resolve({ id: "c1" }),
        });

        expect(response.status).toBe(status);
        expect((await response.json()).error.code).toBe(code);
    });
});
