import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import { ganttCurriculumsSchema } from "./curriculums";
import { ganttDaysSchema } from "./days";
import { ganttEventsSchema } from "./events";

/**
 * Drizzle database schema definition for the Gantt Event Recurrence Exceptions
 * table ("eRE"). A row means: within this curriculum, the recurring event no
 * longer echoes an occurrence onto this day — either the occurrence was
 * deleted outright, or it was materialized into its own standalone event.
 */
export const ganttEventRecurrenceExceptionsSchema = pgTable(
    "eRE",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        curriculumId: text("curriculum_id")
            .notNull()
            .references(() => ganttCurriculumsSchema.id, {
                onDelete: "cascade",
            }),
        eventId: text("event_id")
            .notNull()
            .references(() => ganttEventsSchema.id, { onDelete: "cascade" }),
        dayId: text("day_id")
            .notNull()
            .references(() => ganttDaysSchema.id, { onDelete: "cascade" }),
        // Set when the occurrence was materialized into its own standalone
        // event; null means it was simply skipped and can be restored (#469).
        materializedEventId: text("materialized_event_id").references(
            () => ganttEventsSchema.id,
            { onDelete: "set null" },
        ),
        createdAt: timestamp("ca").defaultNow().notNull(),
    },
    (t) => ({
        unq: unique().on(t.curriculumId, t.eventId, t.dayId),
        idxCurriculum: index("eRE_curriculum_id_idx").on(t.curriculumId),
    }),
);

export const ganttEventRecurrenceExceptionsRelationsSchema = relations(
    ganttEventRecurrenceExceptionsSchema,
    ({ one }) => ({
        curriculum: one(ganttCurriculumsSchema, {
            fields: [ganttEventRecurrenceExceptionsSchema.curriculumId],
            references: [ganttCurriculumsSchema.id],
        }),
        event: one(ganttEventsSchema, {
            fields: [ganttEventRecurrenceExceptionsSchema.eventId],
            references: [ganttEventsSchema.id],
        }),
        day: one(ganttDaysSchema, {
            fields: [ganttEventRecurrenceExceptionsSchema.dayId],
            references: [ganttDaysSchema.id],
        }),
    }),
);
