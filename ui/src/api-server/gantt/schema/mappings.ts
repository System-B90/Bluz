/**
 * Name: assignments.ts
 * Purpose: Curriculum module scheduling and event configurations
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */
import { relations } from "drizzle-orm";
import
    {
        integer,
        pgTable,
        primaryKey,
        real,
        text,
        timestamp,
        unique,
    } from "drizzle-orm/pg-core";

import { ganttCurriculumsSchema } from "./curriculums";
import { ganttDaysSchema } from "./days";
import { ganttEventsSchema } from "./events";
import { ganttModulesSchema } from "./modules";

/**
 * curriculumModuleDayAssignments (cMDA)
 * Schedules modules into specific week/day slots.
 * Optionally, a specific event in the module can be assigned
 */
export const ganttCurriculumEventDayMappingsSchema = pgTable(
    "cMDA",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, { onDelete: "cascade" }),
        moduleId: text("module_id")
            .notNull()
            .references(() => ganttModulesSchema.id, { onDelete: "cascade" }),
        eventId: text("event_id")
            .references(() => ganttEventsSchema.id, { onDelete: "cascade" }),
        dayId: text("day_id")
            .notNull()
            .references(() => ganttDaysSchema.id, { onDelete: "cascade" }),
        sortOrder: real("s").notNull().default(0),
        createdAt: timestamp("ca").defaultNow().notNull(),
        updatedAt: timestamp("ua").defaultNow().notNull(),
    },
    (t) => ({
        unq: unique().on(
            t.curriculumId,
            t.moduleId,
            t.eventId,
            t.dayId
        ),
    }),
);

export const ganttCurriculumEventDayMappingsRelationsSchema = relations(
    ganttCurriculumEventDayMappingsSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ ganttCurriculumEventDayMappingsSchema.curriculumId ],
            references: [ ganttCurriculumsSchema.id ],
        }),
        event: one(ganttEventsSchema, {
            fields: [ ganttCurriculumEventDayMappingsSchema.eventId ],
            references: [ ganttEventsSchema.id ],
        }),
        module: one(ganttModulesSchema, {
            fields: [ ganttCurriculumEventDayMappingsSchema.moduleId ],
            references: [ ganttModulesSchema.id ],
        }),
        day: one(ganttDaysSchema, {
            fields: [ ganttCurriculumEventDayMappingsSchema.dayId ],
            references: [ ganttDaysSchema.id ],
        }),
    }),
);

/**
 * Maps specific durations to an event within the context of a curriculum.
 */
export const ganttCurriculumEventConfigurationsSchema = pgTable(
    "cEC",
    {
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, { onDelete: "cascade" }),
        eventId: text("event_id")
            .notNull()
            .references(() => ganttEventsSchema.id, { onDelete: "cascade" }),
        allocatedDuration: integer("allocated_duration").notNull().default(0),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [ t.curriculumId, t.eventId ] }),
    }),
);

export const ganttCurriculumEventConfigurationsRelationsSchema = relations(
    ganttCurriculumEventConfigurationsSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ ganttCurriculumEventConfigurationsSchema.curriculumId ],
            references: [ ganttCurriculumsSchema.id ],
        }),
        event: one(ganttEventsSchema, {
            fields: [ ganttCurriculumEventConfigurationsSchema.eventId ],
            references: [ ganttEventsSchema.id ],
        }),
    }),
);
