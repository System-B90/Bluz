import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prayer events are re-timed automatically from the prayer settings. Those
 * writes must be attributed to that settings change rather than left unlabeled,
 * and must never be attributed to the gantt (they are not cut events).
 */

vi.mock("@/api-server/db-event", () => ({
    DbEvent: {
        create: vi.fn(async (event: { id: string }) => event),
        getInRange: vi.fn(async () => []),
        set: vi.fn(async (event: { id: string }) => event),
    },
}));
vi.mock("@/api-server/web-socket-utils", () => ({
    // The student refresh ping (#656) is a second network side effect on the
    // same write paths; stubbed alongside the broadcast.
    NotifyStudentsOfCalendarChange: vi.fn(),
    SendServerRequestToSessionServer: vi.fn(),
}));

import { DbEvent } from "@/api-server/db-event";
import { updatePrayerEvents } from "@/api-server/prayer";
import { EventType, PrayerType } from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";

const config = {
    [PrayerType.ARVIT]: new Date("2024-01-07T19:00:00"),
    [PrayerType.MINCHA]: new Date("2024-01-07T13:00:00"),
    [PrayerType.SHACHARIT]: new Date("2024-01-07T06:30:00"),
} as never;

beforeEach(() => vi.clearAllMocks());

describe("prayer event writes", () => {
    it("attributes newly created prayer events to the prayer settings", async () => {
        await updatePrayerEvents({
            newConfig: config,
            startDate: new Date("2024-01-07T00:00:00"),
        });

        // 3 prayers × 7 days.
        expect(DbEvent.create).toHaveBeenCalledTimes(21);
        for (const call of vi.mocked(DbEvent.create).mock.calls) {
            expect(call[4]).toEqual({
                initiator: EventChangeInitiator.PrayerSettings,
            });
        }
    });

    it("attributes re-timed prayer events to the prayer settings", async () => {
        vi.mocked(DbEvent.getInRange).mockResolvedValue([
            {
                endTime: new Date("2024-01-07T07:00:00"),
                id: "p1",
                prayerType: PrayerType.SHACHARIT,
                startTime: new Date("2024-01-07T06:00:00"),
                type: EventType.PRAYER,
            },
        ] as never);

        await updatePrayerEvents({
            newConfig: config,
            startDate: new Date("2024-01-07T00:00:00"),
        });

        expect(DbEvent.create).not.toHaveBeenCalled();
        for (const call of vi.mocked(DbEvent.set).mock.calls) {
            expect(call[4]).toEqual({
                initiator: EventChangeInitiator.PrayerSettings,
            });
        }
    });
});
