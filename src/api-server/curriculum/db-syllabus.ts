import { postgresDb } from "@/api-server/curriculum";
import { drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { syllabuses, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateSyllabusPayload } from "@/api-shared/types/gant/create-payloads";
import { Syllabus, SyllabusId, ModuleId } from "@/api-shared/types/gant/curriculum";
import { eq, and } from "drizzle-orm";

const basicOperations = drizzleOperationsBuilder<
    Syllabus,
    typeof syllabuses,
    CreateSyllabusPayload
>({
    table: syllabuses,
    typeName: 'סילבוס',
    junction: {
        table: syllabusModules,
        localKey: syllabusModules.syllabusId,
        relationKey: syllabusModules.moduleId,
        apiKey: "modules"
    },
    parentJunction: {
        type: 'curriculum',
    },
});

async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    try
    {
        await postgresDb.insert(syllabusModules).values({
            syllabusId: syllabusId,
            moduleId: moduleId,
        });
    } catch (error: any)
    {
        // Unique Violation: Module already linked
        if (error.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`המודול כבר משויך לסילבוס זה`);
        }
        // Foreign Key Violation: Syllabus or Module missing
        if (error.code === FOREIGN_KEY_VIOLATION)
        {
            throw new ClientApiError(`סילבוס או מודול לא קיימים במערכת`);
        }

        throw new ClientApiError(`Failed to add module ${moduleId} to syllabus ${syllabusId}`);
    }
}

async function removeModuleFromSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<void>
{
    const result = await postgresDb.delete(syllabusModules)
        .where(
            and(
                eq(syllabusModules.syllabusId, syllabusId),
                eq(syllabusModules.moduleId, moduleId)
            )
        )
        .returning({ deletedSyllabusId: syllabusModules.syllabusId });

    if (result.length === 0)
    {
        throw new ClientApiError(`No mapping found for module ${moduleId} in syllabus ${syllabusId}`);
    }
}

export const DbSyllabus = {
    ...basicOperations,
    addModule: addModuleToSyllabus,
    removeModule: removeModuleFromSyllabus,
} as const;