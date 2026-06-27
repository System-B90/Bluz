import { relations } from "drizzle-orm";
import {
    index,
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
 * Drizzle database schema definition for the Gantt Curriculum Event Day Mappings table (`cMDA`).
 * Schedules modules into specific week/day slots.
 * Optionally, a specific event in the module can be assigned.
 */
export const ganttCurriculumEventDayMappingsSchema = pgTable(
    "cMDA",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, {
                onDelete: "cascade",
            }),
        moduleId: text("module_id")
            .notNull()
            .references(() => ganttModulesSchema.id, { onDelete: "cascade" }),
        eventId: text("event_id").references(() => ganttEventsSchema.id, {
            onDelete: "cascade",
        }),
        dayId: text("day_id")
            .notNull()
            .references(() => ganttDaysSchema.id, { onDelete: "cascade" }),
        sortOrder: real("s").notNull().default(0),
        createdAt: timestamp("ca").defaultNow().notNull(),
        updatedAt: timestamp("ua").defaultNow().notNull(),
    },
    (t) => ({
        unq: unique().on(t.curriculumId, t.moduleId, t.eventId, t.dayId),
        idxCurriculum: index("cMDA_curriculum_id_idx").on(t.curriculumId),
        idxDay: index("cMDA_day_id_idx").on(t.dayId),
    }),
);

/**
 * Relations definition for the Curriculum Event Day Mappings schema.
 */
export const ganttCurriculumEventDayMappingsRelationsSchema = relations(
    ganttCurriculumEventDayMappingsSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ganttCurriculumEventDayMappingsSchema.curriculumId],
            references: [ganttCurriculumsSchema.id],
        }),
        event: one(ganttEventsSchema, {
            fields: [ganttCurriculumEventDayMappingsSchema.eventId],
            references: [ganttEventsSchema.id],
        }),
        module: one(ganttModulesSchema, {
            fields: [ganttCurriculumEventDayMappingsSchema.moduleId],
            references: [ganttModulesSchema.id],
        }),
        day: one(ganttDaysSchema, {
            fields: [ganttCurriculumEventDayMappingsSchema.dayId],
            references: [ganttDaysSchema.id],
        }),
    }),
);

/**
 * Drizzle database schema definition for the Gantt Curriculum Event Configurations table (`cEC`).
 * Maps specific durations to an event within the context of a curriculum.
 */
export const ganttCurriculumEventConfigurationsSchema = pgTable(
    "cEC",
    {
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, {
                onDelete: "cascade",
            }),
        eventId: text("event_id")
            .notNull()
            .references(() => ganttEventsSchema.id, { onDelete: "cascade" }),
        allocatedDuration: integer("allocated_duration").notNull().default(0),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => ({
        pk: primaryKey({ columns: [t.curriculumId, t.eventId] }),
    }),
);

/**
 * Relations definition for the Curriculum Event Configurations schema.
 */
export const ganttCurriculumEventConfigurationsRelationsSchema = relations(
    ganttCurriculumEventConfigurationsSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ganttCurriculumEventConfigurationsSchema.curriculumId],
            references: [ganttCurriculumsSchema.id],
        }),
        event: one(ganttEventsSchema, {
            fields: [ganttCurriculumEventConfigurationsSchema.eventId],
            references: [ganttEventsSchema.id],
        }),
    }),
);
