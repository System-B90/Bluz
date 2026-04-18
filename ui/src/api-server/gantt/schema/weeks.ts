import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttCurriculum2WeeksSchema, ganttWeek2DaysSchema } from "./junctions";

export const ganttWeeksSchema = pgTable('w', {
    id: text('id').primaryKey(),
    number: integer('number').notNull(),
    comment: text('comment').default(''),
    weekendDuty: boolean('weekend_duty').notNull().default(false),
    createdAt: timestamp('ca').defaultNow().notNull(),
    updatedAt: timestamp('ua').defaultNow().notNull(),
});

export const curriculumWeeksRelations = relations(ganttWeeksSchema, ({ many }) => ({
    c2w: many(ganttCurriculum2WeeksSchema),
    w2d: many(ganttWeek2DaysSchema),
}));
