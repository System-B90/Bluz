/**
 * Name: assignments.ts
 * Purpose: Curriculum module scheduling and event configurations
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */
import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";

import { ganttCurriculumsSchema } from "./curriculums";
import { ganttDaysSchema } from "./days";
import { ganttEventsSchema } from "./events";
import { ganttModulesSchema } from "./modules";
import { ganttWeeksSchema } from "./weeks";

/**
 * curriculumModuleDayAssignments (cMDA)
 * Schedules modules into specific week/day slots.
 */
export const ganttModuleDayAssignmentsSchema = pgTable('cMDA', {
    curriculumId: text('curriculum_id')
        .notNull()
        .references(() => ganttCurriculumsSchema.id, { onDelete: 'cascade' }),
    moduleId: text('module_id')
        .notNull()
        .references(() => ganttModulesSchema.id, { onDelete: 'cascade' }),
    weekId: text('week_id').notNull().references(() => ganttWeeksSchema.id, { onDelete: 'cascade' }),
    dayId: text('day_id').notNull().references(() => ganttDaysSchema.id, { onDelete: 'cascade' }),
    sortOrder: real('s').notNull().default(0),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
}, (t) => ({
    // Primary key ensures a module is unique per curriculum/module pairing
    pk: primaryKey({ columns: [ t.curriculumId, t.moduleId ] })
}));

export const ganttModuleDayAssignmentsRelationsSchema = relations(ganttModuleDayAssignmentsSchema, ({ one }) => ({
    curriculum: one(ganttCurriculumsSchema, {
        fields: [ ganttModuleDayAssignmentsSchema.curriculumId ],
        references: [ ganttCurriculumsSchema.id ],
    }),
    module: one(ganttModulesSchema, {
        fields: [ ganttModuleDayAssignmentsSchema.moduleId ],
        references: [ ganttModulesSchema.id ],
    }),
}));

/**
 * Maps specific durations to an event within the context of a curriculum.
 */
export const ganttCurriculumEventConfigurationsSchema = pgTable('cEC', {
    curriculumId: text('curriculum_id').notNull().references(() => ganttCurriculumsSchema.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull().references(() => ganttEventsSchema.id, { onDelete: 'cascade' }),
    allocatedDuration: integer('allocated_duration').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
    pk: primaryKey({ columns: [ t.curriculumId, t.eventId ] })
}));

export const ganttCurriculumEventConfigurationsRelationsSchema = relations(ganttCurriculumEventConfigurationsSchema, ({ one }) => ({
    curriculum: one(ganttCurriculumsSchema, {
        fields: [ ganttCurriculumEventConfigurationsSchema.curriculumId ],
        references: [ ganttCurriculumsSchema.id ],
    }),
    event: one(ganttEventsSchema, {
        fields: [ ganttCurriculumEventConfigurationsSchema.eventId ],
        references: [ ganttEventsSchema.id ],
    }),
}));
