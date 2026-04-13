import { postgresDb } from "@/api-server/curriculum";
import { BaseDbDocument, drizzleOperationsBuilder, FOREIGN_KEY_VIOLATION, UNIQUE_VIOLATION } from "@/api-server/curriculum/db-base";
import { modules, moduleToEvents, syllabusModules } from "@/api-server/curriculum/schema";
import { ClientApiError } from "@/api-shared/errors";
import { CreateModulePayload } from "@/api-shared/types/gant/create-payloads";
import { Module, ModuleId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { and, eq } from "drizzle-orm";

const basicOperations = drizzleOperationsBuilder<
    Module,
    typeof modules,
    CreateModulePayload
>({
    table: modules,
    typeName: 'מודול',
    junction: {
        table: moduleToEvents,
        localKey: moduleToEvents.moduleId,
        relationKey: moduleToEvents.eventId,
        apiKey: "events"
    },
    parentJunction: {
        type: 'syllabus'
    },
});


async function addModuleToSyllabus(syllabusId: SyllabusId, moduleId: ModuleId): Promise<Module & BaseDbDocument>
{
    try
    {
        await postgresDb.insert(syllabusModules).values({
            syllabusId: syllabusId,
            moduleId: moduleId,
        });
        return await basicOperations.getItem(moduleId);
    } catch (error: any)
    {
        const cause = error.cause as { name: string; severity: string; code: string; detail: string; };

        // Unique Violation: Module already linked
        if (cause?.code === UNIQUE_VIOLATION)
        {
            throw new ClientApiError(`המודול כבר משויך לסילבוס זה`);
        }
        // Foreign Key Violation: Syllabus or Module missing
        if (cause?.code === FOREIGN_KEY_VIOLATION)
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


export const DbModule = {
    ...basicOperations,
    linkItem: addModuleToSyllabus,
    unlinkItem: removeModuleFromSyllabus,
} as const;
