import { and, eq, inArray } from "drizzle-orm";

import { GanttDbExecutor, postgresDb } from "@/api-server/gantt";
import {
    drizzleOperationsBuilder,
    FOREIGN_KEY_VIOLATION,
    postgresErrorCode,
    UNIQUE_VIOLATION,
} from "@/api-server/gantt/db-base";
import {
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttModulesSchema,
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
        cardinality: "one",
    },
});

async function getFullModuleEvent(id: GanttModuleId): Promise<ApiModuleEvent> {
    const result = await postgresDb.query.ganttEventsSchema.findFirst({
        where: eq(ganttEventsSchema.id, id),
        with: {
            cEC: true,
        },
    });

    if (!result) {
        throw new ClientApiError(`מופע עם מזהה ${id} לא נמצא`);
    }

    await basicOperations.attachParentIds([result]);
    return result as unknown as ApiModuleEvent;
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
    } catch (error: unknown) {
        const code = postgresErrorCode(error);

        // Unique Violation: Event already linked to this module
        if (code === UNIQUE_VIOLATION) {
            throw new ClientApiError(`האירוע כבר משויך למערך זה`);
        }
        // Foreign Key Violation: Module or Event missing
        if (code === FOREIGN_KEY_VIOLATION) {
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

/**
 * The event fields a NEW shuffle-group sibling copies from its origin. Everything
 * else is per-sibling on purpose: the id, the shuffle tag, the placement and
 * the curriculum-scoped allocated duration are exactly what makes one shuffle's
 * copy schedulable at a different time from another's (#699).
 */
function groupSiblingFields(origin: GanttEvent) {
    return {
        title: origin.title,
        type: origin.type,
        minimumDuration: origin.minimumDuration,
        orchestratorId: origin.orchestratorId,
        recommendedLecturerIds: origin.recommendedLecturerIds,
        systemRequirements: origin.systemRequirements,
        roomRequirement: origin.roomRequirement,
        recurrence: origin.recurrence,
        recurrenceStartDate: origin.recurrenceStartDate,
        recurrenceEndDate: origin.recurrenceEndDate,
        isCritical: origin.isCritical,
        isPaWindow: origin.isPaWindow,
        splitAcrossBreaks: origin.splitAcrossBreaks,
        comment: origin.comment,
        hiveSubjectId: origin.hiveSubjectId,
        hiveModuleId: origin.hiveModuleId,
        hiveLessonId: origin.hiveLessonId,
    } as const;
}

/** Every event sharing `groupId`, oldest first. */
async function findGroupMembers(
    groupId: string,
    executor: GanttDbExecutor = postgresDb,
): Promise<Array<GanttEvent>> {
    const rows = await executor
        .select()
        .from(ganttEventsSchema)
        .where(eq(ganttEventsSchema.groupId, groupId));

    return (rows as unknown as Array<GanttEvent>).sort((a, b) =>
        a.id.localeCompare(b.id),
    );
}

/**
 * Decides which existing group member keeps which of the `wanted` shuffles.
 *
 * A member that already carries a wanted name keeps it. An untagged (or stale)
 * member takes the next free name instead of being deleted - otherwise grouping
 * an ungrouped event would throw away the very event the user grouped, along
 * with its placement. The origin is offered a free name before any sibling:
 * it is the event whose dialog the user is editing, so losing it to a sibling
 * would delete the event out from under the open dialog.
 *
 * Returns the claimed members by name and the members left without one.
 */
export function assignShuffleGroupMembers<T extends { id: string; shuffles?: Array<string> | null }>(
    existing: Array<T>,
    wanted: Array<string>,
    originId: string,
): { claimed: Map<string, T>; orphans: Array<T> } {
    const wantedSet = new Set(wanted);
    const claimed = new Map<string, T>();
    const orphans: Array<T> = [];

    for (const member of existing) {
        const name = (member.shuffles ?? []).find(
            (shuffle) => wantedSet.has(shuffle) && !claimed.has(shuffle),
        );
        if (name) claimed.set(name, member);
        else orphans.push(member);
    }

    orphans.sort(
        (a, b) => Number(b.id === originId) - Number(a.id === originId),
    );
    for (const name of wanted) {
        if (claimed.has(name)) continue;
        const reusable = orphans.shift();
        if (!reusable) break;
        claimed.set(name, reusable);
    }

    return { claimed, orphans };
}

/**
 * Makes `eventId` cover exactly `shuffles`, one event per shuffle.
 *
 * The group is stored as separate rows rather than one event with many times:
 * each shuffle's copy has to be placed, cut and Hive-linked on its own. This
 * reconciles the group against the requested names in one transaction - the
 * origin keeps the first uncovered name, missing names get a fresh copy, and
 * members whose name is gone are deleted - so a repeated call is idempotent.
 *
 * Returns every surviving member plus the ids that were removed, letting the
 * client patch its store instead of refetching the curriculum.
 */
async function applyShuffleGroup(
    eventId: GanttEventId,
    moduleId: GanttModuleId,
    shuffles: Array<string>,
): Promise<{ members: Array<GanttEvent>; removedIds: Array<GanttEventId> }> {
    const wanted = Array.from(
        new Set(shuffles.map((name) => name.trim()).filter(Boolean)),
    );

    return await postgresDb.transaction(async (tx) => {
        const [origin] = (await tx
            .select()
            .from(ganttEventsSchema)
            .where(eq(ganttEventsSchema.id, eventId))) as unknown as Array<GanttEvent>;

        if (!origin) throw new ClientApiError(`מופע עם מזהה ${eventId} לא נמצא`);

        const groupId = origin.groupId ?? `g_${crypto.randomUUID()}`;
        // New siblings are owned by the module's default אחראי, not a copy of
        // the origin's: each shuffle's lesson usually has its own orchestrator.
        const [parentModule] = await tx
            .select({ defaultOrchestratorId: ganttModulesSchema.defaultOrchestratorId })
            .from(ganttModulesSchema)
            .where(eq(ganttModulesSchema.id, moduleId));
        const siblingOrchestratorId =
            parentModule?.defaultOrchestratorId ?? origin.orchestratorId;
        const existing = origin.groupId
            ? await findGroupMembers(origin.groupId, tx)
            : [origin];

        // Fewer than two shuffles is not a group: drop the marker off every
        // member and leave the events themselves alone.
        if (wanted.length < 2) {
            const ids = existing.map((member) => member.id);
            if (ids.length > 0) {
                await tx
                    .update(ganttEventsSchema)
                    .set({ groupId: null, updatedAt: new Date() })
                    .where(inArray(ganttEventsSchema.id, ids));
            }
            const refreshed = existing.map((member) => ({
                ...member,
                groupId: null,
            }));
            return { members: refreshed, removedIds: [] };
        }

        const { claimed, orphans } = assignShuffleGroupMembers(
            existing,
            wanted,
            eventId,
        );

        const members: Array<GanttEvent> = [];
        for (const name of wanted) {
            const member = claimed.get(name);
            if (member) {
                // An existing member only gets the group's identity - its name
                // and its shuffle. Its duration and placement are its own: they
                // are the reason the lesson was split per shuffle to begin with,
                // so re-applying the group must not overwrite them.
                const [updated] = await tx
                    .update(ganttEventsSchema)
                    .set({
                        title: origin.title,
                        groupId,
                        shuffles: [name],
                        updatedAt: new Date(),
                    })
                    .where(eq(ganttEventsSchema.id, member.id))
                    .returning();
                members.push(updated as unknown as GanttEvent);
                continue;
            }

            members.push(
                (await basicOperations.createNewItem(
                    {
                        ...groupSiblingFields(origin),
                        orchestratorId: siblingOrchestratorId,
                        allocatedDuration: 0,
                        shuffles: [name],
                        groupId,
                        moduleId,
                    } as unknown as CreateGanttEventPayload,
                    tx,
                )) as unknown as GanttEvent,
            );
        }

        // Whatever is left over lost its shuffle: the group no longer covers
        // that name, so the row it owned goes with it.
        const removedIds = orphans.map((member) => member.id);
        if (removedIds.length > 0) {
            await tx
                .delete(ganttEventsSchema)
                .where(inArray(ganttEventsSchema.id, removedIds));
        }

        return { members, removedIds };
    });
}

export const DbModuleEvent = {
    getItem: getFullModuleEvent,
    ...basicOperations,
    linkItem: addEventToModule,
    unlinkItem: removeEventFromModule,
    getAllocatedTime,
    setAllocatedTime,
    applyShuffleGroup,
    findGroupMembers,
} as const;
