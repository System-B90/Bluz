import { describe, it, expect } from "vitest";
import dayjs from "dayjs";

import {
    formatDateTimeChangeNote,
    getSubmitLabel,
    hasUnresolvedConflicts,
} from "@/components/schedule/offline-dialogs/push-updates-dialog/utils";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeCollisionStates(
    entries: Record<string, boolean>,
): CollisionStates {
    const states: CollisionStates = {};
    for (const [id, conflicting] of Object.entries(entries)) {
        states[id] = {
            localModifiedEvent: undefined,
            serverVersion: undefined,
            capturedVersion: undefined,
            conflicting,
        };
    }
    return states;
}

// ─── formatDateTimeChangeNote (#93) ────────────────────────────────────────────

describe("formatDateTimeChangeNote", () => {
    it("returns null when either value is missing", () => {
        expect(formatDateTimeChangeNote(undefined, dayjs())).toBeNull();
        expect(formatDateTimeChangeNote(dayjs(), undefined)).toBeNull();
        expect(formatDateTimeChangeNote(null, dayjs())).toBeNull();
        expect(formatDateTimeChangeNote(dayjs(), null)).toBeNull();
    });

    it("returns null when the values are unchanged", () => {
        const value = dayjs("2026-04-12T09:00:00");
        expect(formatDateTimeChangeNote(value, dayjs(value))).toBeNull();
    });

    it("notes a same-day time shift moved earlier as 'קודם'", () => {
        const from = dayjs("2026-04-11T11:15:00");
        const to = dayjs("2026-04-11T10:15:00");
        expect(formatDateTimeChangeNote(from, to)).toBe(
            "קודם משעה 11:15 לשעה 10:15",
        );
    });

    it("notes a same-day time shift moved later as 'נדחה'", () => {
        const from = dayjs("2026-04-11T10:15:00");
        const to = dayjs("2026-04-11T11:15:00");
        expect(formatDateTimeChangeNote(from, to)).toBe(
            "נדחה משעה 10:15 לשעה 11:15",
        );
    });

    it("notes a cross-day shift moved later as 'נדחה', with weekday names, dates, and day count", () => {
        // 2026-04-11 is a Saturday, 2026-04-14 is a Tuesday: 3 days apart
        const from = dayjs("2026-04-11T09:00:00");
        const to = dayjs("2026-04-14T09:00:00");
        expect(formatDateTimeChangeNote(from, to)).toBe(
            "נדחה מיום שבת ה-11.4 ליום שלישי ה-14.4 (ב-3 ימים)",
        );
    });

    it("notes a cross-day shift moved earlier as 'הוקדם'", () => {
        const from = dayjs("2026-04-14T09:00:00");
        const to = dayjs("2026-04-11T09:00:00");
        expect(formatDateTimeChangeNote(from, to)).toBe(
            "הוקדם מיום שלישי ה-14.4 ליום שבת ה-11.4 (ב-3 ימים)",
        );
    });

    it("uses the singular 'יום אחד' for a one-day shift", () => {
        const from = dayjs("2026-04-11T09:00:00");
        const to = dayjs("2026-04-12T09:00:00");
        expect(formatDateTimeChangeNote(from, to)).toBe(
            "נדחה מיום שבת ה-11.4 ליום ראשון ה-12.4 (ב-יום אחד)",
        );
    });

    it("parses ISO string inputs the same as Dayjs objects", () => {
        expect(
            formatDateTimeChangeNote(
                "2026-04-11T11:15:00",
                "2026-04-11T10:15:00",
            ),
        ).toBe("קודם משעה 11:15 לשעה 10:15");
    });

    it("returns null for invalid date input", () => {
        expect(formatDateTimeChangeNote("not-a-date", dayjs())).toBeNull();
    });
});

// ─── hasUnresolvedConflicts / getSubmitLabel (#94) ─────────────────────────────

describe("hasUnresolvedConflicts", () => {
    it("is false when there are no changes at all", () => {
        expect(hasUnresolvedConflicts(makeCollisionStates({}), [])).toBe(
            false,
        );
    });

    it("is false when there are changes but none of them conflict", () => {
        const states = makeCollisionStates({ e1: false, e2: false });
        expect(hasUnresolvedConflicts(states, [])).toBe(false);
    });

    it("is true when a conflict exists and nothing is selected", () => {
        const states = makeCollisionStates({ e1: true });
        expect(hasUnresolvedConflicts(states, [])).toBe(true);
    });

    it("is true when a conflict exists and only unrelated (non-conflicting) ids are selected", () => {
        const states = makeCollisionStates({ e1: true, e2: false });
        expect(hasUnresolvedConflicts(states, [ "e2" ])).toBe(true);
    });

    it("is false once the conflicting event is selected", () => {
        const states = makeCollisionStates({ e1: true });
        expect(hasUnresolvedConflicts(states, [ "e1" ])).toBe(false);
    });

    it("is false when at least one of several conflicts is selected", () => {
        const states = makeCollisionStates({ e1: true, e2: true, e3: false });
        expect(hasUnresolvedConflicts(states, [ "e2" ])).toBe(false);
    });
});

describe("getSubmitLabel", () => {
    it("reads 'שמירת שינויים מסומנים' when there are no unresolved conflicts", () => {
        const states = makeCollisionStates({ e1: false });
        expect(getSubmitLabel(states, [])).toBe("שמירת שינויים מסומנים");
    });

    it("reads 'קבלת שינויים מרוחקים' when conflicts exist and none are selected", () => {
        const states = makeCollisionStates({ e1: true });
        expect(getSubmitLabel(states, [])).toBe("קבלת שינויים מרוחקים");
    });

    it("reverts to 'שמירת שינויים מסומנים' once the user selects the conflicting event", () => {
        const states = makeCollisionStates({ e1: true });
        expect(getSubmitLabel(states, [ "e1" ])).toBe("שמירת שינויים מסומנים");
    });
});
