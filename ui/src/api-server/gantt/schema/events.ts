import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { moduleEventTypeEnumSchema } from "./enums";
import { ganttModule2EventsSchema } from "./junctions";
import { ganttCurriculumEventConfigurationsSchema } from "./mappings";

export const ganttEventsSchema = pgTable('e', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    type: moduleEventTypeEnumSchema('type').notNull(),
    minimumDuration: integer('minimum_duration').notNull().default(0),
    requirements: jsonb('req').$type<any[]>().notNull().default([]),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
});
export const ganttEventsRelationsSchema = relations(ganttEventsSchema, ({ many }) => ({
    m2e: many(ganttModule2EventsSchema),
    cEC: many(ganttCurriculumEventConfigurationsSchema), // curriculumConfigs
}));
