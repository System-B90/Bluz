import { drizzleOperationsBuilder } from "@/api-server/curriculum/db-base";
import { curriculumDays } from "@/api-server/curriculum/schema";
import { CreateCurriculumDayPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumDay } from "@/api-shared/types/gant/curriculum";

const basicOperations = drizzleOperationsBuilder<
    CurriculumDay,
    typeof curriculumDays,
    CreateCurriculumDayPayload
>({
    table: curriculumDays,
    typeName: 'יום',
    idPreffix: 'd',
});

export const DbDay = {
    ...basicOperations,
} as const;
