import { describe, expect, it } from "vitest";

import { dayjs } from "@/api-shared/dayjs-setup";
import {
    inplaceDateFixupToDate,
    inplaceDateFixupToDayjs,
} from "@/api-shared/date-fixer";

describe("inplaceDateFixupToDate", () => {
    it("parses an ISO string into a native Date in place", () => {
        const item = { start: "2026-03-01T08:00:00.000Z" };

        const result = inplaceDateFixupToDate(item, "start");

        expect(result).toBe(item);
        expect(item.start).toBeInstanceOf(Date);
        expect((item.start as unknown as Date).toISOString()).toBe(
            "2026-03-01T08:00:00.000Z",
        );
    });

    it("fixes every field when given an array of keys", () => {
        const item = {
            start: "2026-03-01T08:00:00.000Z",
            end: "2026-03-01T10:00:00.000Z",
        };

        inplaceDateFixupToDate(item, [ "start", "end" ]);

        expect(item.start).toBeInstanceOf(Date);
        expect(item.end).toBeInstanceOf(Date);
    });

    it("leaves falsy values untouched", () => {
        const item = { start: null, end: "" };

        inplaceDateFixupToDate(item, [ "start", "end" ]);

        expect(item.start).toBeNull();
        expect(item.end).toBe("");
    });

    it("leaves unparsable values untouched instead of writing Invalid Date", () => {
        const item = { start: "not-a-date" };

        inplaceDateFixupToDate(item, "start");

        expect(item.start).toBe("not-a-date");
    });

    it("accepts an epoch number", () => {
        const item = { start: 1_772_000_000_000 as Date | number };

        inplaceDateFixupToDate(item, "start");

        expect(item.start).toBeInstanceOf(Date);
        expect((item.start as Date).getTime()).toBe(1_772_000_000_000);
    });
});

describe("inplaceDateFixupToDayjs", () => {
    it("parses an ISO string into a Dayjs in place", () => {
        const item = { start: "2026-03-01T08:00:00.000Z" };

        inplaceDateFixupToDayjs(item, "start");

        expect(dayjs.isDayjs(item.start)).toBe(true);
        expect((item.start as unknown as ReturnType<typeof dayjs>).toISOString())
            .toBe("2026-03-01T08:00:00.000Z");
    });

    it("leaves falsy and unparsable values untouched", () => {
        const item = { a: null, b: undefined, c: "nope" };

        inplaceDateFixupToDayjs(item, [ "a", "b", "c" ]);

        expect(item.a).toBeNull();
        expect(item.b).toBeUndefined();
        expect(item.c).toBe("nope");
    });

    it("is idempotent on an already-converted field", () => {
        const item = { start: "2026-03-01T08:00:00.000Z" as unknown };

        inplaceDateFixupToDayjs(item, "start");
        const first = item.start;
        inplaceDateFixupToDayjs(item, "start");

        expect(dayjs.isDayjs(item.start)).toBe(true);
        expect(
            (item.start as ReturnType<typeof dayjs>).valueOf(),
        ).toBe((first as ReturnType<typeof dayjs>).valueOf());
    });
});
