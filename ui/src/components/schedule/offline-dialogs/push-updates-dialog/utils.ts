import dayjs from "dayjs";

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
 * Re-export the globally unified recursive deep-comparison helper from EventUtils
 */
export const areDiffValuesEqual = areValuesEqual;
