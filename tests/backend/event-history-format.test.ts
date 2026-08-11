import { describe, expect, it } from "vitest";

import { eventFieldLabel, EVENT_FIELD_LABELS } from "@/api-shared/event-history";
import {
    ChangeValueLookups,
    formatChange,
    formatChangeValue,
    relativeTime,
} from "@/components/schedule/event-dialog/event-history/format-change";

/**
 * Value rendering for the event history panel. The log stores raw wire values
 * (epoch ms, id arrays), so these helpers are what stand between the audit
 * trail and something a person can read.
 */

const lookups: ChangeValueLookups = {
    courseName: (id) => (id === "c1" ? "מסלול א" : undefined),
    instructorName: (id) => (id === 7 ? "מיכאל" : undefined),
    roomName: (id) => (id === "r1" ? "כיתה 1" : undefined),
};

describe("formatChangeValue", () => {
    it("renders an empty value as an em dash", () => {
        for (const value of [null, undefined, ""]) {
            expect(formatChangeValue("name", value, lookups)).toBe("—");
        }
        expect(formatChangeValue("courses", [], lookups)).toBe("—");
    });

    it("renders time fields from epoch milliseconds", () => {
        const at = new Date("2024-01-07T08:30:00").getTime();
        expect(formatChangeValue("startTime", at, lookups)).toBe(
            "07/01/2024 08:30",
        );
    });

    it("renders booleans in Hebrew", () => {
        expect(formatChangeValue("locked", true, lookups)).toBe("כן");
        expect(formatChangeValue("locked", false, lookups)).toBe("לא");
    });

    it("resolves instructor ids to names", () => {
        expect(formatChangeValue("instructors", [7], lookups)).toBe("מיכאל");
    });

    it("falls back to the raw id when a name is unknown", () => {
        expect(formatChangeValue("instructors", [99], lookups)).toBe("#99");
        expect(formatChangeValue("courses", ["zzz"], lookups)).toBe("zzz");
    });

    it("keeps an outsider marker as-is", () => {
        expect(formatChangeValue("lecturers", ["איש חוץ"], lookups)).toBe(
            "איש חוץ",
        );
    });

    it("resolves course ids to names, joined", () => {
        expect(formatChangeValue("courses", ["c1", "c1"], lookups)).toBe(
            "מסלול א, מסלול א",
        );
    });

    it("resolves rooms from their resolvable shape", () => {
        expect(
            formatChangeValue("rooms", [{ id: "r1", source: 1 }], lookups),
        ).toBe("כיתה 1");
    });

    it("passes plain scalars through", () => {
        expect(formatChangeValue("name", "שיעור", lookups)).toBe("שיעור");
        expect(formatChangeValue("subject", 12, lookups)).toBe("12");
    });
});

describe("formatChange", () => {
    it("formats both sides of a change", () => {
        expect(
            formatChange(
                {
                    field: "startTime",
                    from: new Date("2024-01-07T08:00:00").getTime(),
                    to: new Date("2024-01-07T10:00:00").getTime(),
                },
                lookups,
            ),
        ).toEqual({
            field: "startTime",
            from: "07/01/2024 08:00",
            to: "07/01/2024 10:00",
        });
    });
});

describe("eventFieldLabel", () => {
    it("translates known fields", () => {
        expect(eventFieldLabel("startTime")).toBe("שעת התחלה");
        expect(eventFieldLabel("instructors")).toBe("מדריכים");
    });

    it("falls back to the raw key for an unknown field", () => {
        expect(eventFieldLabel("somethingNew")).toBe("somethingNew");
    });

    it("labels every field the cut writes", () => {
        for (const field of [
            "courses",
            "endTime",
            "hiveLesson",
            "hiveModule",
            "instructors",
            "name",
            "notes",
            "splitAcrossBreaks",
            "startTime",
            "subject",
            "type",
        ]) {
            expect(EVENT_FIELD_LABELS[field]).toBeTruthy();
        }
    });
});

describe("relativeTime", () => {
    const minutesAgo = (minutes: number) =>
        new Date(Date.now() - minutes * 60_000).toISOString();

    it("reports a fresh change as just now", () => {
        expect(relativeTime(minutesAgo(0))).toBe("הרגע");
    });

    it("reports minutes, hours and days", () => {
        expect(relativeTime(minutesAgo(5))).toBe("לפני 5 דקות");
        expect(relativeTime(minutesAgo(3 * 60))).toBe("לפני 3 שעות");
        expect(relativeTime(minutesAgo(4 * 24 * 60))).toBe("לפני 4 ימים");
    });

    it("uses the singular and dual forms Hebrew expects", () => {
        expect(relativeTime(minutesAgo(1))).toBe("לפני דקה");
        expect(relativeTime(minutesAgo(2))).toBe("לפני שתי דקות");
        expect(relativeTime(minutesAgo(60))).toBe("לפני שעה");
        expect(relativeTime(minutesAgo(2 * 60))).toBe("לפני שעתיים");
        expect(relativeTime(minutesAgo(24 * 60))).toBe("לפני יום");
        expect(relativeTime(minutesAgo(2 * 24 * 60))).toBe("לפני יומיים");
    });

    it("falls back to a date past a week", () => {
        const old = new Date("2024-01-07T08:00:00");
        expect(relativeTime(old.toISOString())).toBe("07/01/2024");
    });
});
