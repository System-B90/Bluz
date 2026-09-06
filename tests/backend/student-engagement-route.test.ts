import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The engagement counter is written by student sessions, i.e. by an untrusted
 * client (#656). What matters is not that the number is right but that a
 * student can only ever move *their own* number, for today, by a bounded
 * amount.
 */

vi.mock("@/api-server/db-student-engagement", () => ({
    addStudentEngagementSeconds: vi.fn(async () => 0),
}));

import { addStudentEngagementSeconds } from "@/api-server/db-student-engagement";
import { currentAppDate } from "@/api-server/student-view";
import { Clearance } from "@/api-shared/types/hive";
import * as EngagementRoute from "@/app/api/student-view/engagement/route";

const HANICH = { id: "s1", display_name: "חניך", clearance: Clearance.Hanich };

function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/student-view/engagement", {
        body: JSON.stringify(body),
        method: "POST",
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: HANICH } as never);
});

describe("POST /api/student-view/engagement", () => {
    it("attributes the report to the session user and the server's day", async () => {
        const response = await EngagementRoute.POST(makeRequest({ seconds: 30 }));

        expect(response.status).toBe(200);
        expect(addStudentEngagementSeconds).toHaveBeenCalledWith(
            "s1",
            currentAppDate(),
            30,
        );
    });

    it("ignores a userId and date smuggled into the body", async () => {
        await EngagementRoute.POST(
            makeRequest({
                date: "2020-01-01",
                seconds: 30,
                userId: "someone-else",
            }),
        );

        expect(addStudentEngagementSeconds).toHaveBeenCalledWith(
            "s1",
            currentAppDate(),
            30,
        );
    });

    it("passes a non-numeric duration through as zero", async () => {
        await EngagementRoute.POST(makeRequest({ seconds: "9999999" }));

        expect(addStudentEngagementSeconds).toHaveBeenCalledWith(
            "s1",
            currentAppDate(),
            0,
        );
    });

    it("rejects an unauthenticated caller", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);

        const response = await EngagementRoute.POST(makeRequest({ seconds: 30 }));

        expect(response.status).not.toBe(200);
        expect(addStudentEngagementSeconds).not.toHaveBeenCalled();
    });
});
