import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttEventsSchema } from "./events";
import { ganttModulesSchema } from "./modules";

export const constraintTypeEnumSchema = pgEnum("constraint_type", [
    "RELATIONAL",
    "TEMPORAL",
]);
export const relationTypeEnumSchema = pgEnum("relation_type", [
    "after",
    "before",
]);

export const ganttConstraintsSchema = pgTable("cntrs", {
    id: text("id").primaryKey(),
    type: constraintTypeEnumSchema("type").notNull(),

    ownerEventId: text("owner_event_id").references(
        () => ganttEventsSchema.id,
        {
            onDelete: "cascade",
        },
    ),
    ownerModuleId: text("owner_module_id").references(
        () => ganttModulesSchema.id,
        { onDelete: "cascade" },
    ),

    relation: relationTypeEnumSchema("relation"),
    targetEventId: text("target_event_id").references(
        () => ganttEventsSchema.id,
        { onDelete: "cascade" },
    ),
    targetModuleId: text("target_module_id").references(
        () => ganttModulesSchema.id,
        { onDelete: "cascade" },
    ),
    minDelayDays: integer("min_delay_days"),
    maxDelayDays: integer("max_delay_days"),

    allowedDays: integer("allowed_days").array(),
    forbiddenDays: integer("forbidden_days").array(),

    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});

export const ganttConstraintsRelationsSchema = relations(
    ganttConstraintsSchema,
    ({ one }) => ({
        ownerEvent: one(ganttEventsSchema, {
            fields: [ganttConstraintsSchema.ownerEventId],
            references: [ganttEventsSchema.id],
            relationName: "ownerEvent",
        }),
        ownerModule: one(ganttModulesSchema, {
            fields: [ganttConstraintsSchema.ownerModuleId],
            references: [ganttModulesSchema.id],
            relationName: "ownerModule",
        }),
        targetEvent: one(ganttEventsSchema, {
            fields: [ganttConstraintsSchema.targetEventId],
            references: [ganttEventsSchema.id],
            relationName: "targetEvent",
        }),
        targetModule: one(ganttModulesSchema, {
            fields: [ganttConstraintsSchema.targetModuleId],
            references: [ganttModulesSchema.id],
            relationName: "targetModule",
        }),
    }),
);
