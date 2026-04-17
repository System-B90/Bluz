import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttWeeksSchema } from "./weeks";

export const ganttDaysSchema = pgTable('d', {
    id: text('id').primaryKey(),
    weekId: text('week_id').notNull().references(() => ganttWeeksSchema.id, { onDelete: 'cascade' }),
    dayIndex: integer('day_index').notNull(),
    totalWorkingMinutes: integer('total_working_min').notNull().default(0),
    comment: text('comment'),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
});
export const curriculumDaysRelations = relations(ganttDaysSchema, ({ one }) => ({
    week: one(ganttWeeksSchema, { fields: [ ganttDaysSchema.weekId ], references: [ ganttWeeksSchema.id ] }),
}));
