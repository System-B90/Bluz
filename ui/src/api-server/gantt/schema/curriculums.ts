import { relations } from "drizzle-orm";
import { boolean, date, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttEventRecurrenceExceptionsSchema } from "./event-recurrence-exceptions";
import {
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
} from "./junctions";
import {
    ganttCurriculumEventConfigurationsSchema,
    ganttCurriculumEventDayMappingsSchema,
} from "./mappings";

/**
 * Drizzle database schema definition for the Gantt Curriculums table (`c`).
 */
export const ganttCurriculumsSchema = pgTable("c", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startDate: date("start_date", { mode: "string" }),
    isDraft: boolean("draft").notNull().default(true),
    isArchived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Relations definition for the Gantt Curriculums schema.
 */
export const ganttCurriculumsRelationsSchema = relations(
    ganttCurriculumsSchema,
    ({ many }) => ({
        c2s: many(ganttCurriculum2SyllabusesSchema),
        cEC: many(ganttCurriculumEventConfigurationsSchema), // eventConfigs
        cMDA: many(ganttCurriculumEventDayMappingsSchema),
        c2w: many(ganttCurriculum2WeeksSchema),
        eRE: many(ganttEventRecurrenceExceptionsSchema),
    }),
);
