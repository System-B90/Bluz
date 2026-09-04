import { describe, expect, it } from "vitest";

import { idsFromListBody } from "../list-ids";

/**
 * The per-test isolation sweep (#639) deletes whatever a spec left behind. It
 * reads several list endpoints that do not agree on a response shape, and one
 * unhandled shape does not just skip that collection — it throws out of the
 * whole cleanup block, taking every sweep after it. That failure is caught and
 * logged, so the suite stays green while leaking exactly what the sweep exists
 * to collect.
 */
describe("idsFromListBody", () => {
    it("reads ids from the array shape most endpoints answer with", () => {
        expect(
            idsFromListBody({ data: [{ id: "a" }, { id: "b" }] }),
        ).toEqual(["a", "b"]);
    });

    it("reads ids from the keyed map the gantt collection routes answer with", () => {
        // `GET /api/gantt/curriculums` returns Record<id, title>. Treating it
        // as an array threw "flatMap is not a function".
        expect(
            idsFromListBody({ data: { "cur-1": "תוכנית", "cur-2": "אחרת" } }),
        ).toEqual(["cur-1", "cur-2"]);
    });

    it("skips rows with no usable id rather than emitting undefined", () => {
        expect(
            idsFromListBody({ data: [{ id: "a" }, {}, { id: 7 }] }),
        ).toEqual(["a"]);
    });

    it("treats a missing, empty or non-object payload as nothing to sweep", () => {
        expect(idsFromListBody({})).toEqual([]);
        expect(idsFromListBody({ data: null })).toEqual([]);
        expect(idsFromListBody({ data: [] })).toEqual([]);
        expect(idsFromListBody({ data: "nope" })).toEqual([]);
        expect(idsFromListBody(undefined)).toEqual([]);
    });
});
