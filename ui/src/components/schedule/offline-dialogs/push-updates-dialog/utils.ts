import dayjs from "dayjs";

import { GanttDayIndex, getDayNameDisplay } from "@/api-shared/types/gantt/models/day";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import { EventId } from "@/components/schedule/types/event";
import { areValuesEqual } from "@/components/schedule/types/EventUtils";

/**
 * Translations for Event property keys to friendly Hebrew labels.
 */
export const KEY_TRANSLATIONS: Record<string, string> = {
    id: "מזהה מופע",
    name: "שם המופע",
    subject: "נושא",
    hiveModule: "מודול",
    hiveLesson: "שיעור",
    startTime: "זמן התחלה",
    endTime: "זמן סיום",
    type: "סוג",
    courses: "קורסים",
    rooms: "כיתות",
    instructors: "מדריכים",
    lecturers: "מרצים",
    tags: "תגיות",
    notes: "הערות",
    locked: "נעול",
    hidden: "מוסתר",
    required: "חובה",
    personalTalk: "שיחת פרט",
};

/**
 * Formats event property values into elegant, human-readable Hebrew strings.
 */
export function formatValue(value: any, key: string): string {
    if (value === undefined || value === null) {
        return "-";
    }

    // Special case for startTime and endTime which might be ISO strings from server
    if (key === "startTime" || key === "endTime") {
        const parsed = dayjs(value);
        if (parsed.isValid()) {
            return parsed.format("DD/MM/YYYY HH:mm");
        }
    }

    // Special case for Dayjs objects / Dates
    if (dayjs.isDayjs(value) || value instanceof Date) {
        return dayjs(value).format("DD/MM/YYYY HH:mm");
    }

    // Special case for booleans
    if (typeof value === "boolean") {
        return value ? "כן" : "לא";
    }

    // Special case for arrays (e.g. rooms, courses, instructors)
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "אין / ריק";
        }
        return value
            .map((item) => {
                if (typeof item === "object" && item !== null) {
                    if ("name" in item) {
                        return (item as any).name;
                    }
                    return JSON.stringify(item);
                }
                return String(item);
            })
            .join(", ");
    }

    // Special case for objects
    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

/**
 * Builds a human-readable Hebrew note describing a startTime/endTime change,
 * e.g. "קודם משעה 11:15 לשעה 10:15" / "נדחה משעה 10:15 לשעה 11:15" for a
 * same-day time shift, or "הוקדם מיום שלישי ה-14.4 ליום ראשון ה-11.4 (ב-3 ימים)"
 * / "נדחה מיום שני ה-6.4 ליום חמישי ה-9.4 (ב-3 ימים)" when the day changes.
 * Returns null when there's nothing meaningful to report.
 */
export function formatDateTimeChangeNote(from: any, to: any): null | string {
    if (from === undefined || from === null || to === undefined || to === null) {
        return null;
    }

    const fromDate = dayjs(from);
    const toDate = dayjs(to);
    if (!fromDate.isValid() || !toDate.isValid() || fromDate.isSame(toDate)) {
        return null;
    }

    const movedEarlier = toDate.isBefore(fromDate);

    if (fromDate.isSame(toDate, "day")) {
        const verb = movedEarlier ? "קודם" : "נדחה";
        return `${verb} משעה ${fromDate.format("HH:mm")} לשעה ${toDate.format("HH:mm")}`;
    }

    const fromDay = getDayNameDisplay(fromDate.day() as GanttDayIndex);
    const toDay = getDayNameDisplay(toDate.day() as GanttDayIndex);
    const dayDiff = Math.abs(
        toDate.startOf("day").diff(fromDate.startOf("day"), "day"),
    );
    const dayWord = dayDiff === 1 ? "יום אחד" : `${dayDiff} ימים`;
    const verb = movedEarlier ? "הוקדם" : "נדחה";

    return `${verb} מיום ${fromDay} ה-${fromDate.format("D.M")} ליום ${toDay} ה-${toDate.format("D.M")} (ב-${dayWord})`;
}

/**
 * True when the collision set has at least one real conflict (both captured
 * and server versions exist and differ) but none of those conflicting events
 * are currently selected — i.e. saving would be equivalent to accepting the
 * remote version for every conflict.
 */
export function hasUnresolvedConflicts(
    collisionStates: CollisionStates,
    selectedIds: Array<EventId>,
): boolean {
    const conflictingIds = Object.keys(collisionStates).filter(
        (id) => collisionStates[id].conflicting,
    );
    return (
        conflictingIds.length > 0 &&
        !conflictingIds.some((id) => selectedIds.includes(id))
    );
}

/**
 * Label for the dialog's submit button: reflects that saving with no
 * conflicting event selected accepts the remote versions rather than
 * pushing local edits.
 */
export function getSubmitLabel(
    collisionStates: CollisionStates,
    selectedIds: Array<EventId>,
): string {
    return hasUnresolvedConflicts(collisionStates, selectedIds)
        ? "קבלת שינויים מרוחקים"
        : "שמירת שינויים מסומנים";
}

/**
 * Re-export the globally unified recursive deep-comparison helper from EventUtils
 */
export const areDiffValuesEqual = areValuesEqual;
