import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The clamp is the only thing standing between a scripted client and an
 * arbitrary number in the counter (#656), so it is pinned directly.
 */

const findOneAndUpdate = vi.fn(async () => ({ seconds: 30 }));
const updateOne = vi.fn(async () => ({}));

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: () => ({
        studentEngagement: { findOneAndUpdate, updateOne },
    }),
}));

import {
    addStudentEngagementSeconds,
    MAX_ENGAGEMENT_REPORT_SECONDS,
} from "@/api-server/db-student-engagement";

beforeEach(() => {
    vi.clearAllMocks();
    findOneAndUpdate.mockResolvedValue({ seconds: 30 } as never);
});

/** The `$inc` amount the store actually asked Mongo for. */
function incrementedBy(): number {
    const update = findOneAndUpdate.mock.calls[0][1] as {
        $inc: { seconds: number };
    };
    return update.$inc.seconds;
}

describe("addStudentEngagementSeconds", () => {
    it("keys the document by user and day so one student cannot touch another's", async () => {
        await addStudentEngagementSeconds("s1", "2026-03-04", 30);

        expect(findOneAndUpdate.mock.calls[0][0]).toEqual({
            id: "s1:2026-03-04",
        });
    });

    it("clamps an inflated report to the per-report ceiling", async () => {
        await addStudentEngagementSeconds("s1", "2026-03-04", 86_400);

        expect(incrementedBy()).toBe(MAX_ENGAGEMENT_REPORT_SECONDS);
    });

    it("ignores negative, zero and non-finite durations", async () => {
        for (const bad of [0, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(await addStudentEngagementSeconds("s1", "2026-03-04", bad)).toBe(
                0,
            );
        }
        expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("caps a day that has been driven past 24h", async () => {
        findOneAndUpdate.mockResolvedValue({ seconds: 90_000 } as never);

        await addStudentEngagementSeconds("s1", "2026-03-04", 60);

        expect(updateOne).toHaveBeenCalledWith(
            { id: "s1:2026-03-04" },
            { $set: { seconds: 24 * 60 * 60 } },
        );
    });
});
