import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Drizzle database schema definition for the module event type enum.
 */
export const moduleEventTypeEnumSchema = pgEnum("module_event_type", [
    "הרצאה",
    'ע"ע',
    'ל"ע',
    "אחר",
]);

/**
 * Drizzle database schema definition for an event's room requirement.
 */
export const roomRequirementEnumSchema = pgEnum("room_requirement", [
    "בחדר מסווג",
    "בחוץ",
    "כמה כיתות",
    "מחוץ לבסיס",
    "באופן מקוון",
]);

/**
 * Drizzle database schema definition for an event's recurrence cadence.
 */
export const recurrenceEnumSchema = pgEnum("recurrence", [
    "none",
    "daily",
    "weekly",
]);
