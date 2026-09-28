import { describe, expect, it } from "vitest";

import { EventType } from "@/api-shared/types/event";
import {
    DEFAULT_STUDENT_VIEW_SETTINGS,
    isStudentViewSettings,
    resolveStudentViewSettings,
    StudentEventNameMode,
    studentEventName,
} from "@/api-shared/types/settings/student-view";

/** What a student sees as an event's name (#744). */

const event = (type: EventType, name = "אסטרטגיה צבאית מתקדמת") => ({ name, type });

describe("studentEventName", () => {
    it('shows "{type} {symbol}" by default, never the real name', () => {
        expect(studentEventName(event(EventType.EXERCISE), "פא", DEFAULT_STUDENT_VIEW_SETTINGS)).toBe('ע"ע פא');
        expect(studentEventName(event(EventType.LECTURE), "פא", DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("הרצאת פא");
    });

    it("falls back to the label, then a generic word — not the real name", () => {
        expect(studentEventName(event(EventType.LECTURE), undefined, DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("הרצאת");
        expect(studentEventName(event(EventType.OTHER), null, DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("פעילות");
        expect(studentEventName(event(EventType.OTHER), "פא", DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("פא");
    });

    it("keeps break and prayer names", () => {
        expect(studentEventName(event(EventType.BREAK, "ארוחת צהריים"), null, DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("ארוחת צהריים");
        expect(studentEventName(event(EventType.PRAYER, "מנחה"), null, DEFAULT_STUDENT_VIEW_SETTINGS)).toBe("מנחה");
    });

    it("uses configured labels and the full-name mode", () => {
        const custom = { eventNameMode: StudentEventNameMode.SYMBOL, typeLabels: { [EventType.LECTURE]: "שיעור" } };
        expect(studentEventName(event(EventType.LECTURE), "פא", custom)).toBe("שיעור פא");
        const full = { eventNameMode: StudentEventNameMode.FULL, typeLabels: {} };
        expect(studentEventName(event(EventType.LECTURE), "פא", full)).toBe("אסטרטגיה צבאית מתקדמת");
    });
});

describe("studentView settings validation", () => {
    it("rejects malformed values and resolves them to the defaults", () => {
        expect(isStudentViewSettings({ eventNameMode: "leak", typeLabels: {} })).toBe(false);
        expect(isStudentViewSettings({ eventNameMode: "symbol", typeLabels: { nope: "x" } })).toBe(false);
        expect(isStudentViewSettings({ eventNameMode: "symbol", typeLabels: { [EventType.LECTURE]: 3 } })).toBe(false);
        expect(resolveStudentViewSettings(null)).toBe(DEFAULT_STUDENT_VIEW_SETTINGS);
        expect(resolveStudentViewSettings({ eventNameMode: "full" })).toBe(DEFAULT_STUDENT_VIEW_SETTINGS);
    });
});
