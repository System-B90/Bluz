import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import {
    ganttCurriculum2SyllabusesSchema,
    ganttSyllabus2ModulesSchema,
} from "./junctions";

export const ganttSyllabusesSchema = pgTable("s", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    // Free text shown in the syllabus dialog, mirroring a module's description.
    description: text("description").notNull().default(""),
    hiveIds: integer("hive_ids").array().notNull().default([]),
    // Student group ("shuffle") names, e.g. ["ניצה", "לחם"]. Empty ⇒ one group.
    shuffles: text("shuffles").array().notNull().default([]),
    // Shuffle name → description, mirroring the Hive student group's
    // staff-only description. Keyed by name so tags stay plain strings.
    shuffleDescriptions: jsonb("shuffle_descriptions")
        .$type<Record<string, string>>()
        .notNull()
        .default({}),
    // Courses (מסלולים) live in MongoDB, so this is a plain id list rather
    // than a junction table (#702).
    courseIds: text("course_ids").array().notNull().default([]),
    // Hive ids of the אחראי מקצוע instructors.
    leadInstructorIds: integer("lead_instructor_ids").array().notNull().default([]),
    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});

export const ganttSyllabusesRelationsSchema = relations(
    ganttSyllabusesSchema,
    ({ many }) => ({
        c2s: many(ganttCurriculum2SyllabusesSchema),
        s2m: many(ganttSyllabus2ModulesSchema),
    }),
);
