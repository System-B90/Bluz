import { describe, expect, it } from "vitest";

import {
    buildGanttAnnouncements,
    GANTT_KEYBOARD_CODES,
    ganttKeyboardCoordinates,
    ganttScreenReaderInstructions,
    neighbourCell,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/keyboard-drag";

/**
 * Keyboard scheduling on the timeline (#808): before this, only a mouse
 * could place a bar, and screen readers were told (in English) about a
 * Space/arrow gesture that did nothing.
 */

const rect = (left: number, top = 100, width = 40) =>
    ({ left, top, width, height: 34, right: left + width, bottom: top + 34 });

// One RTL row: label column on the right (remove target), days leftwards.
const cells = [
    { id: "label", rect: rect(400, 100, 250), data: { targetType: "remove" } },
    { id: "d1", rect: rect(360), data: { targetType: "event", dayId: "d1" } },
    { id: "d2", rect: rect(320), data: { targetType: "event", dayId: "d2" } },
    { id: "d3", rect: rect(280), data: { targetType: "event", dayId: "d3" } },
    { id: "other-row", rect: rect(320, 140), data: { targetType: "event", dayId: "d2" } },
];

function contextOver(overId: string | null, collisionLeft: number, collisionWidth = 32) {
    const droppableRects = new Map(cells.map((c) => [ c.id, c.rect ]));
    const containers = cells.map((c) => ({ id: c.id, data: { current: c.data } }));
    return {
        droppableRects,
        droppableContainers: { getEnabled: () => containers },
        over: overId ? { id: overId, data: { current: cells.find((c) => c.id === overId)!.data } } : null,
        collisionRect: rect(collisionLeft, 104, collisionWidth),
    };
}

function press(code: string, overId: string | null, collisionLeft: number) {
    return ganttKeyboardCoordinates(
        { code } as KeyboardEvent,
        { active: "a", currentCoordinates: { x: 0, y: 0 }, context: contextOver(overId, collisionLeft) as never },
    );
}

describe("neighbourCell", () => {
    const row = cells.filter((c) => c.id !== "label");

    it("picks the nearest cell in the pressed direction, same row only", () => {
        expect(neighbourCell(row, { left: 320, rowY: 117 }, -1)?.id).toBe("d3");
        expect(neighbourCell(row, { left: 320, rowY: 117 }, 1)?.id).toBe("d1");
        expect(neighbourCell(row, { left: 360, rowY: 157 }, -1)?.id).toBe("other-row");
    });

    it("stops at the row's edge", () => {
        expect(neighbourCell(row, { left: 280, rowY: 117 }, -1)).toBeNull();
    });
});

describe("ganttKeyboardCoordinates (#808)", () => {
    it("moves one cell left (the next day in RTL)", () => {
        expect(press("ArrowLeft", "d1", 364)).toEqual({ x: -40, y: 0 });
    });

    it("moves one cell right", () => {
        expect(press("ArrowRight", "d2", 324)).toEqual({ x: 40, y: 0 });
    });

    it("stays put at the edge and on Up/Down", () => {
        expect(press("ArrowLeft", "d3", 284)).toEqual({ x: 0, y: 0 });
        expect(press("ArrowDown", "d2", 324)).toEqual({ x: 0, y: 0 });
    });

    it("from the label column, centres the bar on the first day", () => {
        // Bar centred at 500 over the label cell; d1's centre is 380.
        expect(press("ArrowLeft", "label", 484)).toEqual({ x: -120, y: 0 });
    });
});

describe("keyboard codes", () => {
    it("leaves Enter free to open the bar (#833)", () => {
        expect(GANTT_KEYBOARD_CODES.start).toEqual([ "Space" ]);
        expect(GANTT_KEYBOARD_CODES.end).not.toContain("Enter");
    });
});

describe("Hebrew drag announcements (#808)", () => {
    const labels = {
        itemName: () => "\"שיעור\"",
        dayLabel: (dayId: string) => `יום שני ${dayId}`,
    };
    const a = buildGanttAnnouncements(labels, (_p, target) => (target?.dayId === "bad" ? "מפר ימי עבודה אסורים" : null));
    const active = { id: "x", data: { current: { eventId: "e1" } } } as never;
    const over = (data: object) => ({ id: "o", data: { current: data } }) as never;

    it("gives Hebrew instructions", () => {
        expect(ganttScreenReaderInstructions.draggable).toMatch(/רווח/);
    });

    it("announces pickup, the hovered day, and a warning when there is one", () => {
        expect(a.onDragStart({ active })).toBe("הורם \"שיעור\".");
        expect(a.onDragOver({ active, over: over({ dayId: "3.8" }) })).toBe("\"שיעור\" מעל יום שני 3.8.");
        expect(a.onDragOver({ active, over: over({ dayId: "bad" }) }))
            .toBe("\"שיעור\" מעל יום שני bad. אזהרה: מפר ימי עבודה אסורים.");
    });

    it("announces the drop and a cancel", () => {
        expect(a.onDragEnd({ active, over: over({ dayId: "3.8" }) })).toBe("\"שיעור\" הונח ביום שני 3.8.");
        expect(a.onDragEnd({ active, over: over({ targetType: "remove" }) })).toBe("\"שיעור\" הונח באזור ההסרה מהציר.");
        expect(a.onDragCancel({ active, over: null })).toBe("הגרירה בוטלה. \"שיעור\" חזר למקומו.");
    });
});
