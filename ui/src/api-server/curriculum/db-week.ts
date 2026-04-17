import { drizzleOperationsBuilder } from "@/api-server/curriculum/db-base";
import { curriculumWeeks } from "@/api-server/curriculum/schema";
import { CreateCurriculumWeekPayload } from "@/api-shared/types/gant/create-payloads";
import { CurriculumWeek } from "@/api-shared/types/gant/curriculum";

function generateWeekTitle(week: { number: number }): string {
    return `שבוע ${week.number}`;
}

function transformWeekFromDb(dbRow: any): CurriculumWeek {
    return {
        id: dbRow.id,
        title: generateWeekTitle(dbRow),
        number: dbRow.number,
        days: dbRow.days || [],
        comment: dbRow.comment,
        closingSaturday: dbRow.closingSaturday,
    };
}

const basicOperations = drizzleOperationsBuilder<
    CurriculumWeek,
    typeof curriculumWeeks,
    CreateCurriculumWeekPayload
>({
    table: curriculumWeeks,
    typeName: 'שבוע',
    idPreffix: 'w',
});

export const DbWeek = {
    listItems: basicOperations.listItems,
    getMultipleItems: async (ids: string[]) => {
        const items = await basicOperations.getMultipleItems(ids);
        return items.map(transformWeekFromDb);
    },
    getItem: async (id: string) => {
        const item = await basicOperations.getItem(id);
        return transformWeekFromDb(item) as any;
    },
    createNewItem: async (payload: CreateCurriculumWeekPayload) => {
        const item = await basicOperations.createNewItem(payload);
        return transformWeekFromDb(item);
    },
    updateItem: async (id: string, updates: Partial<CurriculumWeek>) => {
        const item = await basicOperations.updateItem(id, updates);
        return transformWeekFromDb(item);
    },
    deleteItem: basicOperations.deleteItem,
} as const;
