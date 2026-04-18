import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttCurriculum2SyllabusesSchema, ganttSyllabus2ModulesSchema } from "./junctions";

export const ganttSyllabusesSchema = pgTable('s', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    hiveIds: integer('hive_ids').array().notNull().default([]),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
});

export const ganttSyllabusesRelationsSchema = relations(ganttSyllabusesSchema, ({ many }) => ({
    c2s: many(ganttCurriculum2SyllabusesSchema),
    s2m: many(ganttSyllabus2ModulesSchema),
}));
