import { describe, expect, it } from "vitest";

import {
    normalizeStoredEvents,
    requireIdParam,
} from "@/api-server/calendar-store-request";
import { ClientApiError } from "@/api-shared/errors";
import { EventType } from "@/api-shared/types/event";

/**
 * Unit tests for the request-body/query normalization shared by the calendar
 * store routes. `normalizeOptionalStoredEvents` (the PATCH-style variant from
 * #512) is intentionally not covered here: it does not exist on master yet.
 */

/** An event as it arrives over the wire: dates are ISO strings, not Dates. */
const wireEvent = {
    id: "e1",
    name: "שיעור",
    type: EventType.LECTURE,
    startTime: "2026-03-02T09:00:00.000Z",
    endTime: "2026-03-02T10:00:00.000Z",
    courses: [],
    rooms: [],
    instructors: [],
    tags: [],
};

describe("normalizeStoredEvents", () => {
    it("fixes up date fields that crossed the wire as strings", () => {
        const [event] = normalizeStoredEvents([wireEvent]);

        expect(event.startTime).toBeInstanceOf(Date);
        expect((event.startTime as Date).toISOString()).toBe(
            "2026-03-02T09:00:00.000Z",
        );
        expect(event.endTime).toBeInstanceOf(Date);
        expect((event.endTime as Date).toISOString()).toBe(
            "2026-03-02T10:00:00.000Z",
        );
        // Everything else passes through untouched.
        expect(event.name).toBe("שיעור");
        expect(event.type).toBe(EventType.LECTURE);
    });

    it("does not mutate the caller's objects", () => {
        const original = { ...wireEvent };
        normalizeStoredEvents([wireEvent]);

        expect(wireEvent.startTime).toBe(original.startTime);
    });

    it.each([
        [undefined, "undefined"],
        [null, "null"],
        ["e1,e2", "string"],
        [{ id: "e1" }, "object"],
        [42, "number"],
    ])("turns a %p body field (%s) into no events at all", (events) => {
        expect(normalizeStoredEvents(events)).toEqual([]);
    });

    it("accepts an empty array as an explicit empty list", () => {
        expect(normalizeStoredEvents([])).toEqual([]);
    });
});

describe("requireIdParam", () => {
    const requestWith = (query: string) =>
        new Request(`http://localhost/api/calendar/drafts${query}`);

    it("returns the id when present", () => {
        expect(requireIdParam(requestWith("?id=abc-123"), "missing!")).toBe(
            "abc-123",
        );
    });

    it("rejects the request when the id is missing", () => {
        expect(() =>
            requireIdParam(requestWith(""), "No draft id provided."),
        ).toThrowError(ClientApiError);
        expect(() =>
            requireIdParam(requestWith(""), "No draft id provided."),
        ).toThrowError("No draft id provided.");
    });

    it("rejects an empty id as if it were absent", () => {
        expect(() => requireIdParam(requestWith("?id="), "empty")).toThrowError(
            ClientApiError,
        );
    });

    it("ignores other query params", () => {
        expect(() =>
            requireIdParam(requestWith("?iteration=2026b"), "nope"),
        ).toThrowError(ClientApiError);
    });
});
