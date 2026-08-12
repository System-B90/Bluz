import { describe, expect, it } from "vitest";

import {
    buildReloadDiff,
    GANTT_OWNED_FIELDS,
    occurrenceKey,
} from "@/api-shared/gantt/reload-diff";
import { DbEventDocument, EventType } from "@/api-shared/types/event";

/**
 * Pure unit tests for the reload reconciliation: which occurrences become
 * additions / updates / removals / conflicts, and the precedence rule that a
 * manually edited event is never rewritten unless explicitly overridden.
 */

function makeEvent(
    overrides: { ganttEventId: string; id: string; occurrenceDate: string } & Partial<DbEventDocument>,
): DbEventDocument {
    const { occurrenceDate, ...rest } = overrides;
    return {
        courses: [],
        endTime: new Date(`${occurrenceDate}T09:00:00.000Z`),
        ganttOccurrenceDate: occurrenceDate,
        hidden: false,
        hiveLesson: null,
        hiveModule: 0,
        instructors: [],
        lecturers: [],
        locked: false,
        name: "שיעור",
        notes: "",
        personalTalk: false,
        required: false,
        rooms: [],
        splitAcrossBreaks: false,
        startTime: new Date(`${occurrenceDate}T08:00:00.000Z`),
        subject: 0,
        tags: [],
        type: EventType.LECTURE,
        ...rest,
    } as DbEventDocument;
}

const NO_MANUAL_EDITS = new Set<string>();

describe("occurrenceKey", () => {
    it("joins the gantt event and its occurrence date", () => {
        expect(occurrenceKey("g1", "2024-01-07")).toBe("g1|2024-01-07");
    });
});

describe("buildReloadDiff — classification", () => {
    it("reports an unchanged occurrence as neither update nor conflict", () => {
        const existing = makeEvent({
            ganttEventId: "g1",
            id: "e1",
            occurrenceDate: "2024-01-07",
        });
        const wanted = makeEvent({
            ganttEventId: "g1",
            id: "ignored-new-id",
            occurrenceDate: "2024-01-07",
        });

        const diff = buildReloadDiff({
            actual: [existing],
            desired: [wanted],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff).toMatchObject({
            additions: [],
            conflicts: [],
            removals: [],
            unchanged: 1,
            updates: [],
        });
    });

    it("reports a planned occurrence with no schedule event as an addition", () => {
        const diff = buildReloadDiff({
            actual: [],
            desired: [
                makeEvent({
                    ganttEventId: "g1",
                    id: "new",
                    name: "חדש",
                    occurrenceDate: "2024-01-08",
                }),
            ],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff.additions).toEqual([
            {
                endTime: new Date("2024-01-08T09:00:00.000Z").toISOString(),
                ganttEventId: "g1",
                occurrenceDate: "2024-01-08",
                startTime: new Date("2024-01-08T08:00:00.000Z").toISOString(),
                title: "חדש",
            },
        ]);
    });

    it("reports a drifted occurrence as an update carrying the field diff", () => {
        const diff = buildReloadDiff({
            actual: [
                makeEvent({
                    ganttEventId: "g1",
                    id: "e1",
                    occurrenceDate: "2024-01-07",
                }),
            ],
            desired: [
                makeEvent({
                    endTime: new Date("2024-01-07T11:00:00.000Z"),
                    ganttEventId: "g1",
                    id: "other",
                    occurrenceDate: "2024-01-07",
                    startTime: new Date("2024-01-07T10:00:00.000Z"),
                }),
            ],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff.updates).toHaveLength(1);
        expect(diff.updates[0].eventId).toBe("e1");
        expect(diff.updates[0].changes.map((c) => c.field)).toEqual([
            "endTime",
            "startTime",
        ]);
    });

    it("reports a cut event whose occurrence vanished as a removal", () => {
        const diff = buildReloadDiff({
            actual: [
                makeEvent({
                    ganttEventId: "g1",
                    id: "e1",
                    occurrenceDate: "2024-01-07",
                }),
            ],
            desired: [],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff.removals).toEqual([
            {
                eventId: "e1",
                ganttEventId: "g1",
                occurrenceDate: "2024-01-07",
                title: "שיעור",
            },
        ]);
    });

    it("ignores actual events that carry no gantt provenance", () => {
        const handMade = makeEvent({
            ganttEventId: "g1",
            id: "manual",
            occurrenceDate: "2024-01-07",
        });
        delete (handMade as Partial<DbEventDocument>).ganttEventId;
        delete (handMade as Partial<DbEventDocument>).ganttOccurrenceDate;

        const diff = buildReloadDiff({
            actual: [handMade],
            desired: [],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff.removals).toEqual([]);
        expect(diff.conflicts).toEqual([]);
    });
});

describe("buildReloadDiff — gantt-owned fields only", () => {
    it("does not report drift on schedule-side fields the cut never wrote", () => {
        const diff = buildReloadDiff({
            actual: [
                makeEvent({
                    color: "#123456",
                    ganttEventId: "g1",
                    id: "e1",
                    locked: true,
                    occurrenceDate: "2024-01-07",
                    rooms: [{ id: "r1", source: "hive" }],
                    tags: [7],
                } as never),
            ],
            desired: [
                makeEvent({
                    ganttEventId: "g1",
                    id: "other",
                    occurrenceDate: "2024-01-07",
                }),
            ],
            manuallyEditedIds: NO_MANUAL_EDITS,
        });

        expect(diff.updates).toEqual([]);
        expect(diff.unchanged).toBe(1);
    });

    it("covers exactly the fields the cut populates", () => {
        expect([...GANTT_OWNED_FIELDS]).toEqual([
            "name",
            "type",
            "subject",
            "hiveModule",
            "hiveLesson",
            "startTime",
            "endTime",
            "courses",
            "instructors",
            "notes",
            "splitAcrossBreaks",
        ]);
    });
});

describe("buildReloadDiff — manual-edit precedence", () => {
    const edited = makeEvent({
        ganttEventId: "g1",
        id: "e1",
        occurrenceDate: "2024-01-07",
    });
    const retimed = makeEvent({
        endTime: new Date("2024-01-07T13:00:00.000Z"),
        ganttEventId: "g1",
        id: "other",
        occurrenceDate: "2024-01-07",
        startTime: new Date("2024-01-07T12:00:00.000Z"),
    });

    it("turns a drifted manual edit into a conflict instead of an update", () => {
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [retimed],
            manuallyEditedIds: new Set(["e1"]),
        });

        expect(diff.updates).toEqual([]);
        expect(diff.conflicts).toHaveLength(1);
        expect(diff.conflicts[0]).toMatchObject({
            eventId: "e1",
            kind: "update",
        });
        expect(diff.conflicts[0].changes.map((c) => c.field)).toEqual([
            "endTime",
            "startTime",
        ]);
    });

    it("turns a removal of a manual edit into a removal conflict with no changes", () => {
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [],
            manuallyEditedIds: new Set(["e1"]),
        });

        expect(diff.removals).toEqual([]);
        expect(diff.conflicts).toHaveLength(1);
        expect(diff.conflicts[0]).toMatchObject({
            changes: [],
            eventId: "e1",
            kind: "removal",
        });
    });

    it("attaches the last manual edit as the conflict explanation", () => {
        const reason = {
            actorName: "מיכאל",
            changedAt: "2024-02-01T10:00:00.000Z",
            initiator: "drag-drop",
        };
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [retimed],
            lastManualEditByEvent: new Map([["e1", reason]]),
            manuallyEditedIds: new Set(["e1"]),
        });

        expect(diff.conflicts[0].lastManualEdit).toEqual(reason);
    });

    it("leaves the explanation null when the log has no attributable row", () => {
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [retimed],
            manuallyEditedIds: new Set(["e1"]),
        });

        expect(diff.conflicts[0].lastManualEdit).toBeNull();
    });

    it("applies an overridden manual edit as an ordinary update", () => {
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [retimed],
            manuallyEditedIds: new Set(["e1"]),
            overrideEventIds: new Set(["e1"]),
        });

        expect(diff.conflicts).toEqual([]);
        expect(diff.updates).toHaveLength(1);
        expect(diff.updates[0].eventId).toBe("e1");
    });

    it("applies an overridden manual edit as an ordinary removal", () => {
        const diff = buildReloadDiff({
            actual: [edited],
            desired: [],
            manuallyEditedIds: new Set(["e1"]),
            overrideEventIds: new Set(["e1"]),
        });

        expect(diff.conflicts).toEqual([]);
        expect(diff.removals.map((r) => r.eventId)).toEqual(["e1"]);
    });

    it("never conflicts on an untouched event, edited or not elsewhere", () => {
        const other = makeEvent({
            ganttEventId: "g2",
            id: "e2",
            occurrenceDate: "2024-01-07",
        });
        const diff = buildReloadDiff({
            actual: [edited, other],
            desired: [retimed, other],
            manuallyEditedIds: new Set(["e2"]),
        });

        expect(diff.conflicts).toEqual([]);
        expect(diff.updates.map((u) => u.eventId)).toEqual(["e1"]);
        expect(diff.unchanged).toBe(1);
    });
});
