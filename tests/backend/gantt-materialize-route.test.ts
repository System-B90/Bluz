import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api-server/gantt/db-recurrence-exceptions", () => ({
    materializeRecurrenceOccurrence: vi.fn(),
}));
vi.mock("@/api-server/session-user", () => ({
    requireStaffSession: vi.fn(async () => undefined),
    getSessionUser: vi.fn(async () => ({ id: "u1" })),
}));

import { materializeRecurrenceOccurrence } from "@/api-server/gantt/db-recurrence-exceptions";
import * as MaterializeRoute from "@/app/api/gantt/events/[id]/materialize/route";

const context = { params: Promise.resolve({ id: "e1" }) };

function request(body?: unknown) {
    return new NextRequest(
        "http://localhost/api/gantt/events/e1/materialize",
        {
            method: "POST",
            body: body === undefined ? undefined : JSON.stringify(body),
        },
    );
}

const FULL = { curriculumId: "c1", moduleId: "m1", dayId: "d1" };

beforeEach(() => vi.clearAllMocks());

describe("POST /api/gantt/events/[id]/materialize", () => {
    it("materializes the occurrence for the event named in the path", async () => {
        vi.mocked(materializeRecurrenceOccurrence).mockResolvedValueOnce({
            eventId: "e2",
        } as never);

        const response = await MaterializeRoute.POST(request(FULL), context);

        expect(response.status).toBe(200);
        expect(materializeRecurrenceOccurrence).toHaveBeenCalledWith({
            ...FULL,
            eventId: "e1",
        });
        expect((await response.json()).data).toEqual({ eventId: "e2" });
    });

    it("rejects a body missing any of curriculumId/moduleId/dayId", async () => {
        for (const key of Object.keys(FULL)) {
            const response = await MaterializeRoute.POST(
                request({ ...FULL, [ key ]: undefined }),
                context,
            );

            expect(response.status).toBe(400);
        }
        expect(materializeRecurrenceOccurrence).not.toHaveBeenCalled();
    });

    it("rejects an empty body", async () => {
        const response = await MaterializeRoute.POST(request(), context);

        expect(response.status).toBe(400);
        expect(materializeRecurrenceOccurrence).not.toHaveBeenCalled();
    });

    it("surfaces a failure from the materializer", async () => {
        vi.mocked(materializeRecurrenceOccurrence).mockRejectedValueOnce(
            new Error("no such day"),
        );

        const response = await MaterializeRoute.POST(request(FULL), context);

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});
