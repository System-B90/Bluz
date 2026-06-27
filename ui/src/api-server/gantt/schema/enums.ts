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
