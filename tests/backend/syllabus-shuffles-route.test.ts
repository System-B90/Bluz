import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/db-syllabus", () => ({
    DbSyllabus: { findShuffleUsages: vi.fn(), applyShuffles: vi.fn() },
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import * as ShufflesRoute from "@/app/api/gantt/syllabuses/[id]/shuffles/route";

const EMPTY = { events: [], modules: [] };

function request(query = "", method = "GET", body?: string) {
    return new NextRequest(
        `http://localhost/api/gantt/syllabuses/s1/shuffles${query}`,
        { method, body },
    );
}

const context = (id: string | undefined = "s1") => ({
    params: Promise.resolve({ id: id as string }),
});

beforeEach(() => vi.clearAllMocks());

describe("GET /api/gantt/syllabuses/[id]/shuffles", () => {
    it("splits, trims and drops empties from ?names=", async () => {
        vi.mocked(DbSyllabus.findShuffleUsages).mockResolvedValueOnce(
            EMPTY as never,
        );

        await ShufflesRoute.GET(request("?names=%20א%20,,ב"), context());

        expect(DbSyllabus.findShuffleUsages).toHaveBeenCalledWith("s1", [
            "א",
            "ב",
        ]);
    });

    it("asks about no names at all when the param is absent", async () => {
        vi.mocked(DbSyllabus.findShuffleUsages).mockResolvedValueOnce(
            EMPTY as never,
        );

        await ShufflesRoute.GET(request(), context());

        expect(DbSyllabus.findShuffleUsages).toHaveBeenCalledWith("s1", []);
    });

    it("returns the usages the UI shows before a deletion (#485)", async () => {
        const usages = {
            modules: [ { id: "m1", title: "מודול", shuffles: [ "א" ] } ],
            events: [],
        };
        vi.mocked(DbSyllabus.findShuffleUsages).mockResolvedValueOnce(
            usages as never,
        );

        const response = await ShufflesRoute.GET(
            request("?names=א"),
            context(),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ data: usages });
    });

    it("rejects a request with no syllabus id", async () => {
        const response = await ShufflesRoute.GET(request(), context(""));

        expect(response.status).toBe(400);
        expect(DbSyllabus.findShuffleUsages).not.toHaveBeenCalled();
    });
});

describe("POST /api/gantt/syllabuses/[id]/shuffles", () => {
    it("applies the new list and returns what was cascaded", async () => {
        vi.mocked(DbSyllabus.applyShuffles).mockResolvedValueOnce(
            EMPTY as never,
        );

        const response = await ShufflesRoute.POST(
            request("", "POST", JSON.stringify({ shuffles: [ "א" ] })),
            context(),
        );

        expect(response.status).toBe(200);
        expect(DbSyllabus.applyShuffles).toHaveBeenCalledWith("s1", [ "א" ]);
    });

    it("accepts an explicit empty list — that is how the last shuffle is dropped", async () => {
        vi.mocked(DbSyllabus.applyShuffles).mockResolvedValueOnce(
            EMPTY as never,
        );

        await ShufflesRoute.POST(
            request("", "POST", JSON.stringify({ shuffles: [] })),
            context(),
        );

        expect(DbSyllabus.applyShuffles).toHaveBeenCalledWith("s1", []);
    });

    it("rejects an empty body, a malformed body and a non-string-array shuffles", async () => {
        const bad = [
            undefined,
            "{not json",
            JSON.stringify({ shuffles: "א" }),
            JSON.stringify({ shuffles: [ "א", 7 ] }),
        ];

        for (const body of bad) {
            const response = await ShufflesRoute.POST(
                request("", "POST", body),
                context(),
            );

            expect(response.status).toBe(400);
        }
        expect(DbSyllabus.applyShuffles).not.toHaveBeenCalled();
    });
});
