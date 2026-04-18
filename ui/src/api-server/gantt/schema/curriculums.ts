/**
 * Name: curriculum.ts
 * Purpose: Curriculum, Weeks, and Days definitions
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */
import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
} from "./junctions";
import {
    ganttCurriculumEventConfigurationsSchema,
    ganttCurriculumModuleDayMappingsSchema,
} from "./mappings";

export const ganttCurriculumsSchema = pgTable("c", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    isDraft: boolean("draft").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ganttCurriculumsRelationsSchema = relations(
    ganttCurriculumsSchema,
    ({ many }) => ({
        c2s: many(ganttCurriculum2SyllabusesSchema),
        cEC: many(ganttCurriculumEventConfigurationsSchema), // eventConfigs
        cMDA: many(ganttCurriculumModuleDayMappingsSchema),
        c2w: many(ganttCurriculum2WeeksSchema),
    }),
);
