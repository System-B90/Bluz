import { describe, expect, it } from "vitest";

import { buildDragLabels, dropMessages } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drag-labels";

/** Wording for drop snackbars, undo and drag announcements (#808-#810). */

const labels = buildDragLabels({
    modules: { m1: { title: "קפ\"ה שבוע 1" } },
    events: { e1: { title: "שיעור" } },
    days: { d1: { dayIndex: 1 }, d2: { dayIndex: 3 } },
    dateOfDayId: (dayId) => (dayId === "d1" ? "2026-08-03" : undefined),
});

describe("buildDragLabels", () => {
    it("names an event by its own title and a module by its title", () => {
        expect(labels.itemName({ moduleId: "m1", eventId: "e1" })).toBe("\"שיעור\"");
        expect(labels.itemName({ moduleId: "m1" })).toBe("\"קפ\"ה שבוע 1\"");
    });

    it("falls back to the kind when the item is gone", () => {
        expect(labels.itemName({ moduleId: "gone", eventId: "gone" })).toBe("\"מפגש\"");
        expect(labels.itemName({ moduleId: "gone" })).toBe("\"מערך\"");
    });

    it("names a day by weekday and short date", () => {
        expect(labels.dayLabel("d1")).toBe("יום שני 3.8");
    });

    it("omits the date when the curriculum has none", () => {
        expect(labels.dayLabel("d2")).toBe("יום רביעי");
    });
});

describe("dropMessages", () => {
    it("reads naturally in Hebrew", () => {
        expect(dropMessages.moved("\"שיעור\"", "יום שני 3.8")).toBe("\"שיעור\" הועבר ליום שני 3.8");
        expect(dropMessages.removed("\"שיעור\"")).toBe("\"שיעור\" הוסר מהציר");
    });
});
