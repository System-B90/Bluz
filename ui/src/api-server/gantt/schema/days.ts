import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ganttWeek2DaysSchema } from "./junctions";

export const ganttDaysSchema = pgTable("d", {
    id: text("id").primaryKey(),
    dayIndex: integer("day_index").notNull(),
    totalWorkingMinutes: integer("total_working_min").notNull().default(0),
    /**
     * Explicit end of the day's working window ("HH:mm"), the capacity the cut
     * balancer packs into. Null means "derive it": the day's start time plus
     * `totalWorkingMinutes`, which is exactly how every pre-existing day
     * behaved before the column existed.
     */
    dayEndTime: text("day_end_time"),
    comment: text("comment").notNull().default(""),
    createdAt: timestamp("ca").defaultNow().notNull(),
    updatedAt: timestamp("ua").defaultNow().notNull(),
});
export const curriculumDaysRelations = relations(
    ganttDaysSchema,
    ({ many }) => ({
        w2d: many(ganttWeek2DaysSchema),
    }),
);
