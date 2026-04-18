import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import {
  ganttDaysSchema,
  ganttWeek2DaysSchema,
} from "@/api-server/gantt/schema";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculumDay } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttDayPayload } from "@/api-shared/types/gantt/create-payloads";
import {
  GanttDay,
  GanttDayId,
} from "@/api-shared/types/gantt/models/curriculum";

const basicOperations = drizzleOperationsBuilder<
  GanttDay,
  typeof ganttDaysSchema,
  CreateGanttDayPayload
>({
  table: ganttDaysSchema,
  typeName: "יום",
  idPreffix: "d",
  parentJunction: {
    table: ganttWeek2DaysSchema,
    parentKey: "weekId",
    selfKey: "dayId",
  },
});

async function getFullDay(id: GanttDayId): Promise<ApiCurriculumDay> {
  const result = await postgresDb.query.ganttDaysSchema.findFirst({
    where: eq(ganttDaysSchema.id, id),
  });

  if (!result) {
    throw new ClientApiError(`יום עם מזהה ${id} לא נמצא`);
  }

  return result as any;
}
export const DbDay = {
  getItem: getFullDay,
  ...basicOperations,
} as const;
