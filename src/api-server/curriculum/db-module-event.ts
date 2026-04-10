import { curriculumDbOperationsBuilder } from "@/api-server/curriculum/db-base";
import databaseController from "@/api-server/mongo-db-controller";

const basicOperations = curriculumDbOperationsBuilder({ dbCollection: databaseController.moduleEvents, typeName: 'מופע' });

export const DbModuleEvent = {
    ...basicOperations,
} as const;
