import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { ganttCurriculumsSchema } from "./curriculums";
import { ganttDaysSchema } from "./days";
import { ganttEventsSchema } from "./events";
import { ganttModulesSchema } from "./modules";
import { ganttSyllabusesSchema } from "./syllabuses";
import { ganttWeeksSchema } from "./weeks";

/**
 * Drizzle database schema definition for the Curriculum to Syllabuses junction table (`c2s`).
 */
export const ganttCurriculum2SyllabusesSchema = pgTable(
    "c2s",
    {
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, {
                onDelete: "cascade",
            }),
        syllabusId: text("syllabus_id")
            .notNull()
            .references(() => ganttSyllabusesSchema.id, {
                onDelete: "cascade",
            }),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.curriculumId, t.syllabusId] }),
    }),
);

/**
 * Relations definition for the Curriculum to Syllabuses junction schema.
 */
export const ganttCurriculum2SyllabusesRelationsSchema = relations(
    ganttCurriculum2SyllabusesSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ganttCurriculum2SyllabusesSchema.curriculumId],
            references: [ganttCurriculumsSchema.id],
        }),
        syllabus: one(ganttSyllabusesSchema, {
            fields: [ganttCurriculum2SyllabusesSchema.syllabusId],
            references: [ganttSyllabusesSchema.id],
        }),
    }),
);

/**
 * Drizzle database schema definition for the Syllabus to Modules junction table (`s2m`).
 */
export const ganttSyllabus2ModulesSchema = pgTable(
    "s2m",
    {
        syllabusId: text("syllabus_id")
            .notNull()
            .references(() => ganttSyllabusesSchema.id, {
                onDelete: "cascade",
            }),
        moduleId: text("module_id")
            .notNull()
            .references(() => ganttModulesSchema.id, { onDelete: "cascade" }),
        sortOrder: integer("sort_order").notNull().default(0),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.syllabusId, t.moduleId] }),
    }),
);

/**
 * Relations definition for the Syllabus to Modules junction schema.
 */
export const ganttSyllabus2ModulesRelationsSchema = relations(
    ganttSyllabus2ModulesSchema,
    ({ one }) => ({
        syllabus: one(ganttSyllabusesSchema, {
            fields: [ganttSyllabus2ModulesSchema.syllabusId],
            references: [ganttSyllabusesSchema.id],
        }),
        module: one(ganttModulesSchema, {
            fields: [ganttSyllabus2ModulesSchema.moduleId],
            references: [ganttModulesSchema.id],
        }),
    }),
);

/**
 * Drizzle database schema definition for the Module to Events junction table (`m2e`).
 */
export const ganttModule2EventsSchema = pgTable(
    "m2e",
    {
        moduleId: text("module_id")
            .notNull()
            .references(() => ganttModulesSchema.id, { onDelete: "cascade" }),
        eventId: text("event_id")
            .notNull()
            .references(() => ganttEventsSchema.id, { onDelete: "cascade" }),
        sortOrder: integer("sort_order").notNull().default(0),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.moduleId, t.eventId] }),
    }),
);

/**
 * Relations definition for the Module to Events junction schema.
 */
export const ganttModule2EventsRelationsSchema = relations(
    ganttModule2EventsSchema,
    ({ one }) => ({
        module: one(ganttModulesSchema, {
            fields: [ganttModule2EventsSchema.moduleId],
            references: [ganttModulesSchema.id],
        }),
        event: one(ganttEventsSchema, {
            fields: [ganttModule2EventsSchema.eventId],
            references: [ganttEventsSchema.id],
        }),
    }),
);

/**
 * Drizzle database schema definition for the Curriculum to Weeks junction table (`c2w`).
 */
export const ganttCurriculum2WeeksSchema = pgTable(
    "c2w",
    {
        curriculumId: text("c_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, {
                onDelete: "cascade",
            }),
        weekId: text("w_id")
            .notNull()
            .references(() => ganttWeeksSchema.id, { onDelete: "cascade" }),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.curriculumId, t.weekId] }),
    }),
);

/**
 * Relations definition for the Curriculum to Weeks junction schema.
 */
export const ganttCurriculum2WeeksRelationsSchema = relations(
    ganttCurriculum2WeeksSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ganttCurriculum2WeeksSchema.curriculumId],
            references: [ganttCurriculumsSchema.id],
        }),
        week: one(ganttWeeksSchema, {
            fields: [ganttCurriculum2WeeksSchema.weekId],
            references: [ganttWeeksSchema.id],
        }),
    }),
);

/**
 * Drizzle database schema definition for the Week to Days junction table (`w2d`).
 */
export const ganttWeek2DaysSchema = pgTable(
    "w2d",
    {
        weekId: text("w_id")
            .notNull()
            .references(() => ganttWeeksSchema.id, { onDelete: "cascade" }),
        dayId: text("d_id")
            .notNull()
            .references(() => ganttDaysSchema.id, { onDelete: "cascade" }),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.weekId, t.dayId] }),
    }),
);

/**
 * Relations definition for the Week to Days junction schema.
 */
export const ganttWeek2DaysRelationsSchema = relations(
    ganttWeek2DaysSchema,
    ({ one }) => ({
        week: one(ganttWeeksSchema, {
            fields: [ganttWeek2DaysSchema.weekId],
            references: [ganttWeeksSchema.id],
        }),
        day: one(ganttDaysSchema, {
            fields: [ganttWeek2DaysSchema.dayId],
            references: [ganttDaysSchema.id],
        }),
    }),
);
