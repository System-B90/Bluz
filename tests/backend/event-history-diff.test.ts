import { describe, expect, it } from "vitest";

import {
    diffEventFields,
    hasManualEdit,
    INITIATOR_LABELS,
    lastManualEdit,
} from "@/api-shared/event-history";
import {
    EventChangeInitiator,
    isGanttInitiator,
    parseEventInitiator,
} from "@/api-shared/types/event-history";

/**
 * Pure unit tests for the event change log helpers: what counts as a field
 * change, which initiators are machine-made, and how the log answers "was this
 * event touched by a human?" — the predicate the gantt reload leans on.
 */

describe("diffEventFields", () => {
    it("returns nothing for a creation (no before)", () => {
        expect(diffEventFields(null, { name: "א" })).toEqual([]);
    });

    it("reports only fields that actually differ, sorted by field", () => {
        const changes = diffEventFields(
            { name: "א", notes: "", subject: 1 },
            { name: "ב", notes: "", subject: 2 },
        );
        expect(changes.map((c) => c.field)).toEqual(["name", "subject"]);
        expect(changes[0]).toEqual({ field: "name", from: "א", to: "ב" });
    });

    it("compares dates by instant, not identity", () => {
        const before = { startTime: new Date("2024-01-07T08:00:00.000Z") };
        const same = { startTime: new Date("2024-01-07T08:00:00.000Z") };
        const later = { startTime: new Date("2024-01-07T09:00:00.000Z") };

        expect(diffEventFields(before, same)).toEqual([]);
        expect(diffEventFields(before, later)).toEqual([
            {
                field: "startTime",
                from: new Date("2024-01-07T08:00:00.000Z").getTime(),
                to: new Date("2024-01-07T09:00:00.000Z").getTime(),
            },
        ]);
    });

    it("treats undefined and null as the same absent value", () => {
        expect(
            diffEventFields({ hiveLesson: undefined }, { hiveLesson: null }),
        ).toEqual([]);
    });

    it("compares arrays element-wise", () => {
        expect(
            diffEventFields({ courses: ["a", "b"] }, { courses: ["a", "b"] }),
        ).toEqual([]);
        expect(
            diffEventFields({ courses: ["a"] }, { courses: ["a", "b"] }),
        ).toHaveLength(1);
    });

    it("ignores bookkeeping fields that change on every write", () => {
        expect(
            diffEventFields(
                { id: "e1", name: "א", updatedAt: 1 },
                { id: "e1", name: "א", updatedAt: 2 },
            ),
        ).toEqual([]);
    });

    it("reports a field that only one side has", () => {
        const changes = diffEventFields({ name: "א" }, { name: "א", color: "#fff" });
        expect(changes).toEqual([{ field: "color", from: null, to: "#fff" }]);
    });
});

describe("initiator classification", () => {
    it("treats every gantt-pipeline initiator as machine-made", () => {
        expect(isGanttInitiator(EventChangeInitiator.GanttCut)).toBe(true);
        expect(isGanttInitiator(EventChangeInitiator.GanttReload)).toBe(true);
        expect(isGanttInitiator(EventChangeInitiator.GanttPullBack)).toBe(true);
    });

    it("treats every human-facing initiator as a manual edit", () => {
        for (const initiator of [
            EventChangeInitiator.CopyPaste,
            EventChangeInitiator.DragDrop,
            EventChangeInitiator.EventDialog,
            EventChangeInitiator.GoogleSync,
            EventChangeInitiator.InstructorAssign,
            EventChangeInitiator.Keyboard,
            EventChangeInitiator.OfflinePush,
            EventChangeInitiator.PrayerSettings,
            EventChangeInitiator.Resize,
            EventChangeInitiator.SnapshotRestore,
            EventChangeInitiator.Unknown,
        ]) {
            expect(isGanttInitiator(initiator)).toBe(false);
        }
    });

    it("labels every initiator (no untranslated enum member)", () => {
        for (const initiator of Object.values(EventChangeInitiator)) {
            expect(INITIATOR_LABELS[initiator]).toBeTruthy();
        }
    });
});

describe("parseEventInitiator", () => {
    it("accepts a known value", () => {
        expect(parseEventInitiator("drag-drop")).toBe(
            EventChangeInitiator.DragDrop,
        );
    });

    it("falls back to Unknown for anything unrecognized", () => {
        for (const value of [null, undefined, "", "gantt-cut-but-not-really"]) {
            expect(parseEventInitiator(value)).toBe(
                EventChangeInitiator.Unknown,
            );
        }
    });
});

describe("hasManualEdit / lastManualEdit", () => {
    const row = (initiator: EventChangeInitiator, changedAt: string) => ({
        changedAt: new Date(changedAt),
        initiator,
    });

    it("is false for a log holding only gantt writes", () => {
        expect(
            hasManualEdit([
                row(EventChangeInitiator.GanttCut, "2024-01-01T00:00:00Z"),
                row(EventChangeInitiator.GanttReload, "2024-01-02T00:00:00Z"),
            ]),
        ).toBe(false);
    });

    it("is true as soon as one non-gantt write exists", () => {
        expect(
            hasManualEdit([
                row(EventChangeInitiator.GanttCut, "2024-01-01T00:00:00Z"),
                row(EventChangeInitiator.Resize, "2024-01-02T00:00:00Z"),
            ]),
        ).toBe(true);
    });

    it("is false for an empty log", () => {
        expect(hasManualEdit([])).toBe(false);
    });

    it("returns the newest manual row regardless of input order", () => {
        const latest = lastManualEdit([
            row(EventChangeInitiator.DragDrop, "2024-01-05T00:00:00Z"),
            row(EventChangeInitiator.GanttReload, "2024-01-09T00:00:00Z"),
            row(EventChangeInitiator.EventDialog, "2024-01-07T00:00:00Z"),
        ]);
        expect(latest?.initiator).toBe(EventChangeInitiator.EventDialog);
    });

    it("returns null when nothing manual is present", () => {
        expect(
            lastManualEdit([
                row(EventChangeInitiator.GanttCut, "2024-01-01T00:00:00Z"),
            ]),
        ).toBeNull();
    });
});
