import { and, eq } from "drizzle-orm";

import { postgresDb } from "@/api-server/gantt";
import {
    drizzleOperationsBuilder,
    FOREIGN_KEY_VIOLATION,
    UNIQUE_VIOLATION,
} from "@/api-server/gantt/db-base";
import {
    ganttEventsSchema,
    ganttModule2EventsSchema,
} from "@/api-server/gantt/schema";
import { ganttCurriculumEventConfigurationsSchema } from "@/api-server/gantt/schema/mappings";
import { ClientApiError } from "@/api-shared/errors";
import { ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttEventPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttEvent,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

/**
 * Basic CRUD operations for the 'ganttEventsSchema' table.
 * Note: This entity does not have a downstream junction table in the current hierarchy.
 */
const basicOperations = drizzleOperationsBuilder<
    GanttEvent,
    typeof ganttEventsSchema,
    CreateGanttEventPayload
>({
    table: ganttEventsSchema,
    typeName: "מופע",
    idPrefix: "e",
    parentJunction: {
        table: ganttModule2EventsSchema,
        parentKey: "moduleId",
        selfKey: "eventId",
    },
});

async function getFullModuleEvent(id: GanttModuleId): Promise<ApiModuleEvent> {
    const result = await postgresDb.query.ganttEventsSchema.findFirst({
        where: eq(ganttEventsSchema.id, id),
        with: {
            cEC: {
                where: (c, { eq }) => eq(c.curriculumId, id),
            },
        },
    });

    if (!result) {
        throw new ClientApiError(`מופע עם מזהה ${id} לא נמצא`);
    }

    return result as any;
}

/**
 * Associates a specific event with a module in the junction table.
 */
async function addEventToModule(
    moduleId: GanttModuleId,
    eventId: GanttEventId,
): Promise<ApiModuleEvent> {
    try {
        await postgresDb.insert(ganttModule2EventsSchema).values({
            moduleId: moduleId,
            eventId: eventId,
        });
        return await getFullModuleEvent(eventId);
    } catch (error: any) {
        const cause = error.cause as {
            name: string;
            severity: string;
            code: string;
            detail: string;
        };

        // Unique Violation: Event already linked to this module
        if (cause?.code === UNIQUE_VIOLATION) {
            throw new ClientApiError(`האירוע כבר משויך למערך זה`);
        }
        // Foreign Key Violation: Module or Event missing
        if (cause?.code === FOREIGN_KEY_VIOLATION) {
            throw new ClientApiError(`מערך או אירוע לא קיימים במערכת`);
        }

        throw new ClientApiError(
            `Failed to add event ${eventId} to module ${moduleId}`,
        );
    }
}

/**
 * Removes the association between a module and an event.
 */
async function removeEventFromModule(
    moduleId: GanttModuleId,
    eventId: GanttEventId,
): Promise<void> {
    const result = await postgresDb
        .delete(ganttModule2EventsSchema)
        .where(
            and(
                eq(ganttModule2EventsSchema.moduleId, moduleId),
                eq(ganttModule2EventsSchema.eventId, eventId),
            ),
        )
        .returning({ deletedModuleId: ganttModule2EventsSchema.moduleId });

    if (result.length === 0) {
        throw new ClientApiError(
            `No mapping found for event ${eventId} in module ${moduleId}`,
        );
    }
}

/**
 * Retrieves the specific allocated duration for an event within a curriculum context.
 */
async function getAllocatedTime(
    eventId: GanttEventId,
    curriculumId: GanttCurriculumId,
): Promise<number> {
    const result =
        await postgresDb.query.ganttCurriculumEventConfigurationsSchema.findFirst(
            {
                where: and(
                    eq(
                        ganttCurriculumEventConfigurationsSchema.curriculumId,
                        curriculumId,
                    ),
                    eq(
                        ganttCurriculumEventConfigurationsSchema.eventId,
                        eventId,
                    ),
                ),
                columns: {
                    allocatedDuration: true,
                },
            },
        );

    return result?.allocatedDuration ?? 0;
}

/**
 * Sets or updates the allocated duration for a specific event in a curriculum.
 * Uses an upsert strategy to maintain data integrity.
 */
async function setAllocatedTime(
    eventId: GanttEventId,
    curriculumId: GanttCurriculumId,
    duration: number,
): Promise<void> {
    await postgresDb
        .insert(ganttCurriculumEventConfigurationsSchema)
        .values({
            curriculumId,
            eventId,
            allocatedDuration: duration,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                ganttCurriculumEventConfigurationsSchema.curriculumId,
                ganttCurriculumEventConfigurationsSchema.eventId,
            ],
            set: {
                allocatedDuration: duration,
                updatedAt: new Date(),
            },
        });
}

export const DbModuleEvent = {
    getItem: getFullModuleEvent,
    ...basicOperations,
    linkItem: addEventToModule,
    unlinkItem: removeEventFromModule,
    getAllocatedTime,
    setAllocatedTime,
} as const;
