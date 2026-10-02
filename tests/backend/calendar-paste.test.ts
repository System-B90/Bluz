// @vitest-environment jsdom
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { pastedEventFrom } from "@/components/schedule/calendar/calendar/paste";
import { slotUnderPointer } from "@/components/schedule/calendar/calendar/slot-context-menu";
import { Event } from "@/components/schedule/types/event";

const copied = {
    id: "e1",
    title: "מופע",
    rooms: [ { id: "r1", source: "Hive" } ],
    startTime: dayjs("2026-03-01T08:00:00.000Z"),
    endTime: dayjs("2026-03-01T09:30:00.000Z"),
} as unknown as Event;

describe("pastedEventFrom (#859)", () => {
    it("keeps duration and rooms, starts at the slot", () => {
        const pasted = pastedEventFrom(copied, { start: new Date("2026-03-02T11:00:00.000Z") });
        expect(pasted.startTime.toISOString()).toBe("2026-03-02T11:00:00.000Z");
        expect(pasted.endTime.diff(pasted.startTime, "minute")).toBe(90);
        expect(pasted.rooms).toEqual(copied.rooms);
        expect(pasted.id).toBeUndefined();
    });

    it("lands 30 minutes after the original without a slot", () => {
        expect(pastedEventFrom(copied, null).startTime.toISOString()).toBe("2026-03-01T08:30:00.000Z");
    });

    it("clears rooms on the unassigned column", () => {
        const pasted = pastedEventFrom(copied, { start: new Date(), resourceId: "Custom:no-room-unassigned" });
        expect(pasted.rooms).toEqual([]);
    });
});

describe("slotUnderPointer (#859)", () => {
    function fakeRoot(elements: Array<Element>) {
        return { elementsFromPoint: () => elements } as unknown as Document;
    }

    function slot(start: number, resource?: string, inDayColumn = true) {
        const column = document.createElement("div");
        if (inDayColumn) column.className = "rbc-day-slot";
        const el = document.createElement("div");
        el.setAttribute("data-slot-start", String(start));
        if (resource) el.setAttribute("data-slot-resource", resource);
        column.appendChild(el);
        return el;
    }

    it("resolves the stamped slot under the pointer, skipping the event overlay", () => {
        const overlay = document.createElement("div");
        const found = slotUnderPointer(0, 0, fakeRoot([ overlay, slot(1_000, "Hive:r1") ]));
        expect(found).toEqual({ start: new Date(1_000), resourceId: "Hive:r1" });
    });

    it("ignores the time gutter (slots outside a day column)", () => {
        expect(slotUnderPointer(0, 0, fakeRoot([ slot(1_000, undefined, false) ]))).toBeNull();
    });

    it("is null off the grid", () => {
        expect(slotUnderPointer(0, 0, fakeRoot([ document.body ]))).toBeNull();
    });
});