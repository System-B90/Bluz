import { beforeEach, describe, expect, it, vi } from "vitest";

const CONTROLLER = { tag: "controller" };
const hiveClient = {
    getLessons: vi.fn(),
    getModuleQueues: vi.fn(),
};

vi.mock("@/api-server/hive/session-client", () => ({
    createHiveClient: vi.fn(async () => hiveClient),
}));
vi.mock("@/api-server/hive/lesson-activation", () => ({
    runLessonActivationTick: vi.fn(),
}));
vi.mock("@/api-server/iteration-request", () => ({
    resolveIterationFromRequest: vi.fn(async () => ({
        controller: CONTROLLER,
        iterationId: "2026-a",
    })),
    resolveWritableIterationFromRequest: vi.fn(async () => ({
        controller: CONTROLLER,
        iterationId: "2026-a",
    })),
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { runLessonActivationTick } from "@/api-server/hive/lesson-activation";
import { createHiveClient } from "@/api-server/hive/session-client";
import { resolveWritableIterationFromRequest } from "@/api-server/iteration-request";
import * as ActivationRoute from "@/app/api/hive/lesson-activation/route";
import * as LessonsRoute from "@/app/api/hive/lessons/route";
import * as QueuesRoute from "@/app/api/hive/queues/route";

const request = (path: string, method = "GET") =>
    new Request(`http://localhost${path}`, { method });

beforeEach(() => {
    vi.clearAllMocks();
    hiveClient.getLessons.mockReset();
    hiveClient.getModuleQueues.mockReset();
});

describe("GET /api/hive/lessons", () => {
    it("forwards every query param to Hive verbatim", async () => {
        hiveClient.getLessons.mockResolvedValueOnce([ { id: 1 } ]);

        const response = await LessonsRoute.GET(
            request("/api/hive/lessons?module=7&search=חדש"),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(hiveClient.getLessons).toHaveBeenCalledWith({
            module: "7",
            search: "חדש",
        });
        expect((await response.json()).data).toEqual([ { id: 1 } ]);
    });

    it("asks for everything when no params are given", async () => {
        hiveClient.getLessons.mockResolvedValueOnce([]);

        await LessonsRoute.GET(request("/api/hive/lessons"), undefined as never);

        expect(hiveClient.getLessons).toHaveBeenCalledWith({});
    });

    it("surfaces a Hive failure as an error response", async () => {
        hiveClient.getLessons.mockRejectedValueOnce(new Error("hive down"));

        const response = await LessonsRoute.GET(
            request("/api/hive/lessons"),
            undefined as never,
        );

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});

describe("GET /api/hive/queues", () => {
    it("fetches the queues of the requested module, as a number", async () => {
        hiveClient.getModuleQueues.mockResolvedValueOnce([ { id: 9 } ]);

        const response = await QueuesRoute.GET(
            request("/api/hive/queues?module=17"),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect(hiveClient.getModuleQueues).toHaveBeenCalledWith(17);
    });

    it("rejects a missing, zero or non-numeric module before calling Hive", async () => {
        for (const query of [ "", "?module=", "?module=0", "?module=abc" ]) {
            const response = await QueuesRoute.GET(
                request(`/api/hive/queues${query}`),
                undefined as never,
            );

            expect(response.status).toBe(400);
        }
        expect(createHiveClient).not.toHaveBeenCalled();
        expect(hiveClient.getModuleQueues).not.toHaveBeenCalled();
    });
});

describe("POST /api/hive/lesson-activation", () => {
    it("runs one pass against the writable iteration and reports it", async () => {
        const result = {
            consideredEvents: 2,
            activated: 1,
            alreadyActive: 1,
            failed: 0,
            errors: [],
        };
        vi.mocked(runLessonActivationTick).mockResolvedValueOnce(
            result as never,
        );

        const response = await ActivationRoute.POST(
            request("/api/hive/lesson-activation", "POST"),
            undefined as never,
        );

        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual(result);
        expect(resolveWritableIterationFromRequest).toHaveBeenCalled();

        const [ now, controller ] = vi.mocked(runLessonActivationTick).mock
            .calls[ 0 ];
        expect(now).toBeInstanceOf(Date);
        expect(controller).toBe(CONTROLLER);
    });

    it("reports failures from the pass rather than hiding them", async () => {
        vi.mocked(runLessonActivationTick).mockResolvedValueOnce({
            consideredEvents: 1,
            activated: 0,
            alreadyActive: 0,
            failed: 1,
            errors: [ "unresolved group" ],
        } as never);

        const { data } = await (
            await ActivationRoute.POST(
                request("/api/hive/lesson-activation", "POST"),
                undefined as never,
            )
        ).json();

        expect(data.failed).toBe(1);
        expect(data.errors).toEqual([ "unresolved group" ]);
    });
});
