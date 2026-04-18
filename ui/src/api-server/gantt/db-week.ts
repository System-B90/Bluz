import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import { DbDay } from "@/api-server/gantt/db-day";
import {
  ganttCurriculum2WeeksSchema,
  ganttWeek2DaysSchema,
} from "@/api-server/gantt/schema";
import { ganttWeeksSchema } from "@/api-server/gantt/schema/weeks";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculumWeek } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttWeekPayload } from "@/api-shared/types/gantt/create-payloads";
import {
  GanttDayIndex,
  GanttWeek,
  GanttWeekId,
} from "@/api-shared/types/gantt/models/curriculum";

const basicOperations = drizzleOperationsBuilder<
  GanttWeek,
  typeof ganttWeeksSchema,
  CreateGanttWeekPayload
>({
  table: ganttWeeksSchema,
  typeName: "שבוע",
  idPreffix: "w",
  junction: {
    table: ganttWeek2DaysSchema,
    localKey: ganttWeek2DaysSchema.weekId,
    relationKey: ganttWeek2DaysSchema.dayId,
    apiKey: "days",
  },
  parentJunction: {
    table: ganttCurriculum2WeeksSchema,
    parentKey: "curriculumId",
    selfKey: "weekId",
  },
});

async function getFullWeek(id: GanttWeekId): Promise<ApiCurriculumWeek> {
  const result = await postgresDb.query.ganttWeeksSchema.findFirst({
    where: eq(ganttWeeksSchema.id, id),
    with: {
      w2d: {
        with: {
          day: true,
        },
      },
    },
  });

  if (!result) {
    throw new ClientApiError(`שבוע עם מזהה ${id} לא נמצא`);
  }

  return result as any;
}

async function createWeek(
  data: CreateGanttWeekPayload,
): Promise<ApiCurriculumWeek> {
  const newWeek = await basicOperations.createNewItem(data);

  const newDays = await Promise.all(
    [
      GanttDayIndex.Sunday,
      GanttDayIndex.Monday,
      GanttDayIndex.Tuesday,
      GanttDayIndex.Wednesday,
      GanttDayIndex.Thursday,
      GanttDayIndex.Friday,
      GanttDayIndex.Saturday,
    ].map(async (dayIndex) => {
      const createPayload = {
        weekId: newWeek.id,
        dayIndex: dayIndex,
        totalWorkingMinutes:
          dayIndex < 6 ? 14 * 60 : dayIndex === 6 ? 2 * 60 : 0,
      };

      return DbDay.createNewItem(createPayload);
    }),
  );

  const days: ApiCurriculumWeek["w2d"] = newDays
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((d): ApiCurriculumWeek["w2d"][0] => ({
      day: d as any,
      weekId: newWeek.id,
      dayId: d.id,
    }));

  const apiWeek: ApiCurriculumWeek = { ...newWeek, w2d: days } as any;
  return apiWeek;
}

export const DbWeek = {
  getItem: getFullWeek,
  ...basicOperations,
  createNewItem: createWeek,
} as const;
