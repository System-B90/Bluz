/**
 * Name: enums.ts
 * Purpose: Global schema enums
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */
import { pgEnum } from "drizzle-orm/pg-core";

export const moduleEventTypeEnumSchema = pgEnum('module_event_type', [
    'הרצאה',
    'ע"ע',
    'ל"ע',
    'אחר'
]);
