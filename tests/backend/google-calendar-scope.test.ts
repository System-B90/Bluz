import { describe, expect, it } from "vitest";

import {
    calendarWantsEvent,
    eventUserIds,
} from "@/api-server/google/google-calendar-scope";

/**
 * The one place that decides whether a Google calendar should hold a Bluz
 * event. Shared by the push fan-out and the orphan purge, so a disagreement
 * between the two would either orphan copies or delete live ones.
 */

describe("eventUserIds", () => {
    it("collects instructors and numeric lecturers as strings, deduped", () => {
        expect(
            [ ...eventUserIds({ instructors: [ 1, 2 ], lecturers: [ 2, 3, "outsider" ] }) ].sort(),
        ).toEqual([ "1", "2", "3" ]);
    });

    it("is empty for an unassigned event", () => {
        expect(eventUserIds({ instructors: [], lecturers: undefined }).size).toBe(0);
    });
});

describe("calendarWantsEvent", () => {
    const event = { instructors: [ 1 ], lecturers: [ "outsider" ] };

    it("is false with no subscribers", () => {
        expect(calendarWantsEvent(event, [])).toBe(false);
    });

    it("is true when any subscriber is assigned", () => {
        expect(
            calendarWantsEvent(event, [
                { userId: "5", syncAllEvents: false },
                { userId: "1", syncAllEvents: false },
            ]),
        ).toBe(true);
    });

    it("is true when any subscriber syncs everything", () => {
        expect(
            calendarWantsEvent(event, [ { userId: "5", syncAllEvents: true } ]),
        ).toBe(true);
    });

    it("is false when nobody is assigned and nobody syncs everything", () => {
        expect(
            calendarWantsEvent(event, [ { userId: "5", syncAllEvents: false } ]),
        ).toBe(false);
    });

    it("never matches an outsider lecturer against a user id", () => {
        expect(
            calendarWantsEvent(event, [ { userId: "outsider", syncAllEvents: false } ]),
        ).toBe(false);
    });
});
