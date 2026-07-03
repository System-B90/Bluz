import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

import { ganttConstraintsSchema } from "./constraints";
import {
    moduleEventTypeEnumSchema,
    recurrenceEnumSchema,
    roomRequirementEnumSchema,
} from "./enums";
import { ganttModule2EventsSchema } from "./junctions";
import { ganttCurriculumEventConfigurationsSchema } from "./mappings";

export const ganttEventsSchema = pgTable("e", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: moduleEventTypeEnumSchema("type").notNull(),
    minimumDuration: integer("minimum_duration").notNull().default(0),
    // Hive id of the responsible instructor ("אחראי"); optional.
    orchestratorId: integer("orchestrator_id"),
    // Outsider IDs, ordered by recommendation priority (top = highest).
    recommendedLecturerIds: text("recommended_lecturer_ids")
        .array()
        .notNull()
        .default([]),
    // Free-text system requirements.
    systemRequirements: text("system_requirements")
        .array()
        .notNull()
        .default([]),
    roomRequirement: roomRequirementEnumSchema("room_requirement")
        .notNull()
        .default("בחדר מסווג"),
    recurrence: recurrenceEnumSchema("recurrence").notNull().default("none"),
    isCritical: boolean("is_critical").notNull().default(false),
    isPaWindow: boolean("is_pa_window").notNull().default(false),
    comment: text("comment"),
    // Shuffle names this event applies to. Empty ⇒ all shuffles.
    shuffles: text("shuffles").array().notNull().default([]),
    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});
export const ganttEventsRelationsSchema = relations(
    ganttEventsSchema,
    ({ many }) => ({
        m2e: many(ganttModule2EventsSchema),
        cEC: many(ganttCurriculumEventConfigurationsSchema), // curriculumConfigs
        constraints: many(ganttConstraintsSchema, {
            relationName: "ownerEvent",
        }),
        targetedByConstraints: many(ganttConstraintsSchema, {
            relationName: "targetEvent",
        }),
    }),
);
