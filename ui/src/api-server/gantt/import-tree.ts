import crypto from "crypto";

import { postgresDb } from "@/api-server/gantt";
import { sanitizeCreatePayload } from "@/api-server/gantt/db-base";
import {
    ganttConstraintsSchema,
    ganttCurriculum2SyllabusesSchema,
    ganttEventsSchema,
    ganttModule2EventsSchema,
    ganttModulesSchema,
    ganttSyllabus2ModulesSchema,
    ganttSyllabusesSchema,
} from "@/api-server/gantt/schema";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";

/**
 * Shared by the curriculum import and the single-syllabus import (#757): both
 * copy a syllabus subtree and the constraints between its modules/events.
 */

export type ImportTx = Parameters<Parameters<typeof postgresDb.transaction>[0]>[0];

/** Old → new ids, filled while the tree is copied, read by `importConstraints`. */
export type ImportIdMaps = {
    moduleIdMap: Record<string, string>;
    eventIdMap: Record<string, string>;
};

/**
 * Upper bound on the total number of entities a single import may create.
 * Guards the recursive walk against a hostile/corrupt payload that would
 * otherwise fan out into an unbounded number of inserts (#162).
 */
export const MAX_IMPORT_NODES = 50_000;

/**
 * Junction rows come back from the export with their `sortOrder`, but the
 * shared `Api*` junction shapes do not declare it; read it defensively.
 */
export function junctionSortOrder(link: unknown): number {
    const value = (link as { sortOrder?: unknown })?.sortOrder;
    return typeof value === "number" ? value : 0;
}

/**
 * Builds an insert row for an exported entity: every real column of the
 * target table is carried over (recurrence, shuffles, lecturers, room
 * requirements, …), relational/junction fields (`s2m`, `m2e`) are
 * dropped by the column filter, enums are validated (bad value → 400), and the
 * server-owned id/timestamps are replaced.
 */
export function importRow(
    table: Parameters<typeof sanitizeCreatePayload>[0],
    source: unknown,
    typeName: string,
    id: string,
    now: Date,
): Record<string, unknown> {
    return {
        ...sanitizeCreatePayload(
            table,
            source as Record<string, unknown>,
            typeName,
        ),
        id,
        createdAt: now,
        updatedAt: now,
    };
}

/** The syllabus, its modules and their events. */
export function countSyllabusNodes(syllabus: ApiSyllabus | undefined): number {
    let count = 1;
    const modules = syllabus?.s2m;
    if (!Array.isArray(modules)) return count;
    for (const s2m of modules) {
        count += 1;
        const events = s2m?.module?.m2e;
        if (Array.isArray(events)) count += events.length;
    }
    return count;
}

/**
 * Copies `source` (an exported syllabus tree) under `curriculumId` with fresh
 * ids. Returns the new syllabus id.
 */
export async function importSyllabusTree(
    tx: ImportTx,
    source: ApiSyllabus,
    options: {
        curriculumId: string;
        now: Date;
        maps: ImportIdMaps;
        titleSuffix?: string;
    },
): Promise<string> {
    const { curriculumId, now, maps, titleSuffix } = options;
    const newSyllabusId = `s_${crypto.randomUUID()}`;
    const row = importRow(ganttSyllabusesSchema, source, "סילבוס", newSyllabusId, now);
    if (titleSuffix) row.title = `${source.title}${titleSuffix}`;
    await tx
        .insert(ganttSyllabusesSchema)
        .values(row as typeof ganttSyllabusesSchema.$inferInsert);

    await tx.insert(ganttCurriculum2SyllabusesSchema).values({
        curriculumId,
        syllabusId: newSyllabusId,
    });

    if (!Array.isArray(source.s2m)) return newSyllabusId;

    for (const s2mItem of source.s2m) {
        const oldModule = s2mItem.module;
        if (!oldModule) continue;

        const newModuleId = `m_${crypto.randomUUID()}`;
        maps.moduleIdMap[oldModule.id] = newModuleId;

        await tx
            .insert(ganttModulesSchema)
            .values(
                importRow(
                    ganttModulesSchema,
                    oldModule,
                    "מערך",
                    newModuleId,
                    now,
                ) as typeof ganttModulesSchema.$inferInsert,
            );

        await tx.insert(ganttSyllabus2ModulesSchema).values({
            syllabusId: newSyllabusId,
            moduleId: newModuleId,
            sortOrder: junctionSortOrder(s2mItem),
        });

        if (!Array.isArray(oldModule.m2e)) continue;

        for (const m2eItem of oldModule.m2e) {
            const oldEvent = m2eItem.event;
            if (!oldEvent) continue;

            const newEventId = `e_${crypto.randomUUID()}`;
            maps.eventIdMap[oldEvent.id] = newEventId;

            await tx.insert(ganttEventsSchema).values({
                ...(importRow(
                    ganttEventsSchema,
                    oldEvent,
                    "מופע",
                    newEventId,
                    now,
                ) as typeof ganttEventsSchema.$inferInsert),
                // The Hive lesson belongs to the exported event; two events
                // sharing one id fight over it in lesson-sync.
                hiveLessonId: null,
            });

            await tx.insert(ganttModule2EventsSchema).values({
                moduleId: newModuleId,
                eventId: newEventId,
                sortOrder: junctionSortOrder(m2eItem),
            });
        }
    }

    return newSyllabusId;
}

type ExportedConstraint = Record<string, unknown> & {
    ownerEventId?: null | string;
    ownerModuleId?: null | string;
    targetEventId?: null | string;
    targetModuleId?: null | string;
};

/**
 * Re-creates `constraints` against the ids in `maps`. A constraint whose owner
 * was not imported is dropped; a target outside the import is cleared.
 */
export async function importConstraints(
    tx: ImportTx,
    constraints: unknown,
    maps: ImportIdMaps,
    now: Date,
): Promise<void> {
    if (!Array.isArray(constraints)) return;
    const { eventIdMap, moduleIdMap } = maps;
    for (const constraint of constraints as Array<ExportedConstraint>) {
        const ownerEventId = constraint.ownerEventId
            ? eventIdMap[constraint.ownerEventId]
            : null;
        const ownerModuleId = constraint.ownerModuleId
            ? moduleIdMap[constraint.ownerModuleId]
            : null;

        // A constraint must have at least one owner mapped to be relevant
        if (!ownerEventId && !ownerModuleId) continue;

        const targetEventId = constraint.targetEventId
            ? eventIdMap[constraint.targetEventId]
            : null;
        const targetModuleId = constraint.targetModuleId
            ? moduleIdMap[constraint.targetModuleId]
            : null;

        // Validated like a create so a bad enum (type/relation) is a 400
        // naming the field rather than a raw PostgresError.
        await tx.insert(ganttConstraintsSchema).values(
            importRow(
                ganttConstraintsSchema,
                {
                    ...constraint,
                    ownerEventId,
                    ownerModuleId,
                    targetEventId,
                    targetModuleId,
                    relation: constraint.relation || null,
                    minDelayDays: constraint.minDelayDays || null,
                    maxDelayDays: constraint.maxDelayDays || null,
                    allowedDays: constraint.allowedDays || null,
                    forbiddenDays: constraint.forbiddenDays || null,
                },
                "אילוץ",
                crypto.randomUUID(),
                now,
            ) as typeof ganttConstraintsSchema.$inferInsert,
        );
    }
}
