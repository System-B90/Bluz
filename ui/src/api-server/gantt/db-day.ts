import { eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import { drizzleOperationsBuilder } from "@/api-server/gantt/db-base";
import { ganttDaysSchema, ganttWeek2DaysSchema } from "@/api-server/gantt/schema";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculumDay } from "@/api-shared/types/gantt/api-layer";
import { CreateCurriculumDayPayload } from "@/api-shared/types/gantt/create-payloads";
import { CurriculumDay, CurriculumDayId } from "@/api-shared/types/gantt/curriculum";

const basicOperations = drizzleOperationsBuilder<
    CurriculumDay,
    typeof ganttDaysSchema,
    CreateCurriculumDayPayload
>({
    table: ganttDaysSchema,
    typeName: 'יום',
    idPreffix: 'd',
    parentJunction: {
        table: ganttWeek2DaysSchema,
        parentKey: 'weekId',
        selfKey: 'dayId',
    }
});

async function getFullDay(id: CurriculumDayId): Promise<ApiCurriculumDay>
{
    const result = await postgresDb.query.ganttDaysSchema.findFirst({
        where: eq(ganttDaysSchema.id, id),
    });

    if (!result)
    {
        throw new ClientApiError(`יום עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}
export const DbDay = {
    getItem: getFullDay,
    ...basicOperations,
} as const;
