import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttWeek2DaysSchema } from "./junctions";

export const ganttDaysSchema = pgTable('d', {
    id: text('id').primaryKey(),
    dayIndex: integer('day_index').notNull(),
    totalWorkingMinutes: integer('total_working_min').notNull().default(0),
    comment: text('comment'),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
});
export const curriculumDaysRelations = relations(ganttDaysSchema, ({ many }) => ({
    w2d: many(ganttWeek2DaysSchema),
}));
