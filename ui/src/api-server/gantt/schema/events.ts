import { relations } from "drizzle-orm";
import {
    boolean,
    date,
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
import { ganttEventRecurrenceExceptionsSchema } from "./event-recurrence-exceptions";
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
    // Recurrence window (#468). Null start ⇒ echo from wherever the event is
    // mapped; null end ⇒ echo to the end of the timeline.
    recurrenceStartDate: date("recurrence_start_date"),
    recurrenceEndDate: date("recurrence_end_date"),
    isCritical: boolean("is_critical").notNull().default(false),
    isPaWindow: boolean("is_pa_window").notNull().default(false),
    splitAcrossBreaks: boolean("split_across_breaks").notNull().default(false),
    comment: text("comment"),
    // Shuffle names this event applies to. Empty ⇒ all shuffles.
    shuffles: text("shuffles").array().notNull().default([]),
    // Shuffle group: sibling events sharing this id are the same lesson given
    // to different shuffles at different times. Null ⇒ ungrouped (#699).
    groupId: text("group_id"),
    // Hive linkage copied onto schedule events by the "גזירה ללו"ז" cut; all optional.
    hiveSubjectId: integer("hive_subject_id"),
    hiveModuleId: integer("hive_module_id"),
    // Text, not integer: some Hive instances key lessons by UUID rather than
    // a numeric pk (#682-adjacent). Stored as whatever string Hive returned.
    hiveLessonId: text("hive_lesson_id"),
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
        eRE: many(ganttEventRecurrenceExceptionsSchema),
    }),
);
