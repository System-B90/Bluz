import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
    ganttModule2EventsSchema,
    ganttSyllabus2ModulesSchema,
} from "./junctions";

/**
 * Drizzle database schema definition for the Gantt Modules table (`m`).
 */
export const ganttModulesSchema = pgTable("m", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("desc").notNull().default(""),
    hiveIds: integer("hive_ids").array().notNull().default([]),
    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});

/**
 * Relations definition for the Gantt Modules schema.
 */
export const ganttModuleRelationsSchema = relations(
    ganttModulesSchema,
    ({ many }) => ({
        s2m: many(ganttSyllabus2ModulesSchema),
        m2e: many(ganttModule2EventsSchema),
    }),
);
