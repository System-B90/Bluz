import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttConstraintsSchema } from "./constraints";
import { moduleEventTypeEnumSchema } from "./enums";
import { ganttModule2EventsSchema } from "./junctions";
import { ganttCurriculumEventConfigurationsSchema } from "./mappings";

export const ganttEventsSchema = pgTable("e", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: moduleEventTypeEnumSchema("type").notNull(),
    minimumDuration: integer("minimum_duration").notNull().default(0),
    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});
export const ganttEventsRelationsSchema = relations(
    ganttEventsSchema,
    ({ many }) => ({
        m2e: many(ganttModule2EventsSchema),
        cEC: many(ganttCurriculumEventConfigurationsSchema), // curriculumConfigs
        constraints: many(ganttConstraintsSchema, { relationName: "ownerEvent" }),
        targetedByConstraints: many(ganttConstraintsSchema, { relationName: "targetEvent" }),
    }),
);
