import crypto from "crypto";

import { NextRequest } from "next/server";

import {
    ApiSuccess,
    requireJsonObjectBody,
    withApi,
} from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
import { sanitizeCreatePayload } from "@/api-server/gantt/db-base";
import {
    ganttCurriculumsSchema,
    ganttCurriculum2SyllabusesSchema,
    ganttCurriculum2WeeksSchema,
    ganttSyllabusesSchema,
    ganttSyllabus2ModulesSchema,
    ganttModulesSchema,
    ganttModule2EventsSchema,
    ganttEventsSchema,
    ganttWeeksSchema,
    ganttWeek2DaysSchema,
    ganttDaysSchema,
    ganttCurriculumEventConfigurationsSchema,
    ganttCurriculumEventDayMappingsSchema,
    ganttConstraintsSchema,
} from "@/api-server/gantt/schema";
import { requireStaffSession } from "@/api-server/session-user";
import { ClientApiError } from "@/api-shared/errors";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";

export const dynamic = "force-dynamic";

// Upper bound on the total number of entities a single import may create.
// Guards the recursive curriculum walk against a hostile/corrupt payload that
// would otherwise fan out into an unbounded number of inserts (#162).
const MAX_IMPORT_NODES = 50_000;

/**
 * Junction rows come back from the export with their `sortOrder`, but the
 * shared `Api*` junction shapes do not declare it; read it defensively.
 */
function junctionSortOrder(link: unknown): number {
    const value = (link as { sortOrder?: unknown })?.sortOrder;
    return typeof value === "number" ? value : 0;
}

/**
 * Builds an insert row for an exported entity: every real column of the
 * target table is carried over (recurrence, shuffles, lecturers, room
 * requirements, …), relational/junction fields (`s2m`, `m2e`, `cEC`) are
 * dropped by the column filter, enums are validated (bad value → 400), and the
 * server-owned id/timestamps are replaced.
 */
function importRow(
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

/**
 * Counts the entities the import would create (weeks, days, syllabuses,
 * modules, events, mappings, constraints) without touching the DB, so an
 * oversized payload is rejected up front rather than mid-transaction.
 */
function countImportNodes(
    curriculum: ApiCurriculum,
    mappings: unknown,
    constraints: unknown,
): number {
    let count = 1; // the curriculum itself
    if (Array.isArray(curriculum?.c2w)) {
        for (const c2w of curriculum.c2w) {
            count += 1;
            const days = c2w?.week?.w2d;
            if (Array.isArray(days)) count += days.length;
        }
    }
    if (Array.isArray(curriculum?.c2s)) {
        for (const c2s of curriculum.c2s) {
            count += 1;
            const modules = c2s?.syllabus?.s2m;
            if (Array.isArray(modules)) {
                for (const s2m of modules) {
                    count += 1;
                    const events = s2m?.module?.m2e;
                    if (Array.isArray(events)) count += events.length;
                }
            }
        }
    }
    if (Array.isArray(mappings)) count += mappings.length;
    if (Array.isArray(constraints)) count += constraints.length;
    return count;
}

export const POST = withApi(async (request: NextRequest) => {
    await requireStaffSession();
    const { curriculum, mappings, constraints } = await requireJsonObjectBody<{
        curriculum?: ApiCurriculum;
        mappings?: unknown;
        constraints?: unknown;
    }>(request);

    if (!curriculum || !curriculum.title) {
        throw new ClientApiError("שגיאה: נתוני גאנט לא תקינים.");
    }

    if (
        countImportNodes(curriculum, mappings, constraints) > MAX_IMPORT_NODES
    ) {
        throw new ClientApiError("שגיאה: קובץ הייבוא גדול מדי.");
    }

    const newCurriculumId = `c_${crypto.randomUUID()}`;
    const oldCurriculumId = curriculum.id;

    const dayIdMap: Record<string, string> = {};
    const moduleIdMap: Record<string, string> = {};
    const eventIdMap: Record<string, string> = {};

    const result = await postgresDb.transaction(async (tx) => {
        // 1. Create Curriculum
        const now = new Date();
        const [newCurriculum] = await tx
            .insert(ganttCurriculumsSchema)
            .values({
                id: newCurriculumId,
                title: `${curriculum.title} (מיובא)`,
                description: curriculum.description || "",
                startDate: curriculum.startDate,
                isDraft: true,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        // 2. Import Weeks and Days
        if (Array.isArray(curriculum.c2w)) {
            for (const c2wItem of curriculum.c2w) {
                const oldWeek = c2wItem.week;
                if (!oldWeek) continue;

                const newWeekId = `w_${crypto.randomUUID()}`;
                await tx.insert(ganttWeeksSchema).values({
                    id: newWeekId,
                    number: oldWeek.number,
                    comment: oldWeek.comment || "",
                    weekendDuty: oldWeek.weekendDuty || false,
                    createdAt: now,
                    updatedAt: now,
                });

                await tx.insert(ganttCurriculum2WeeksSchema).values({
                    curriculumId: newCurriculumId,
                    weekId: newWeekId,
                });

                if (Array.isArray(oldWeek.w2d)) {
                    for (const w2dItem of oldWeek.w2d) {
                        const oldDay = w2dItem.day;
                        if (!oldDay) continue;

                        const newDayId = `d_${crypto.randomUUID()}`;
                        dayIdMap[oldDay.id] = newDayId;

                        await tx.insert(ganttDaysSchema).values({
                            id: newDayId,
                            dayIndex: oldDay.dayIndex,
                            totalWorkingMinutes:
                                oldDay.totalWorkingMinutes || 0,
                            dayEndTime: oldDay.dayEndTime ?? null,
                            comment: oldDay.comment || "",
                            createdAt: now,
                            updatedAt: now,
                        });

                        await tx.insert(ganttWeek2DaysSchema).values({
                            weekId: newWeekId,
                            dayId: newDayId,
                        });
                    }
                }
            }
        }

        // 3. Import Syllabuses, Modules, and Events
        if (Array.isArray(curriculum.c2s)) {
            for (const c2sItem of curriculum.c2s) {
                const oldSyllabus = c2sItem.syllabus;
                if (!oldSyllabus) continue;

                const newSyllabusId = `s_${crypto.randomUUID()}`;
                await tx
                    .insert(ganttSyllabusesSchema)
                    .values(
                        importRow(
                            ganttSyllabusesSchema,
                            oldSyllabus,
                            "סילבוס",
                            newSyllabusId,
                            now,
                        ) as typeof ganttSyllabusesSchema.$inferInsert,
                    );

                await tx.insert(ganttCurriculum2SyllabusesSchema).values({
                    curriculumId: newCurriculumId,
                    syllabusId: newSyllabusId,
                });

                if (Array.isArray(oldSyllabus.s2m)) {
                    for (const s2mItem of oldSyllabus.s2m) {
                        const oldModule = s2mItem.module;
                        if (!oldModule) continue;

                        const newModuleId = `m_${crypto.randomUUID()}`;
                        moduleIdMap[oldModule.id] = newModuleId;

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

                        if (Array.isArray(oldModule.m2e)) {
                            for (const m2eItem of oldModule.m2e) {
                                const oldEvent = m2eItem.event;
                                if (!oldEvent) continue;

                                const newEventId = `e_${crypto.randomUUID()}`;
                                eventIdMap[oldEvent.id] = newEventId;

                                await tx
                                    .insert(ganttEventsSchema)
                                    .values({
                                        ...(importRow(
                                            ganttEventsSchema,
                                            oldEvent,
                                            "מופע",
                                            newEventId,
                                            now,
                                        ) as typeof ganttEventsSchema.$inferInsert),
                                        // The Hive lesson belongs to the
                                        // exported event; two events sharing
                                        // one id fight over it in lesson-sync.
                                        hiveLessonId: null,
                                    });

                                await tx
                                    .insert(ganttModule2EventsSchema)
                                    .values({
                                        moduleId: newModuleId,
                                        eventId: newEventId,
                                        sortOrder: junctionSortOrder(m2eItem),
                                    });

                                // Extract and save event configurations (cEC)
                                if (Array.isArray(oldEvent.cEC)) {
                                    const originalConfig = oldEvent.cEC.find(
                                        (cfg: { curriculumId: string }) =>
                                            cfg.curriculumId ===
                                            oldCurriculumId,
                                    );
                                    if (originalConfig) {
                                        await tx
                                            .insert(
                                                ganttCurriculumEventConfigurationsSchema,
                                            )
                                            .values({
                                                curriculumId: newCurriculumId,
                                                eventId: newEventId,
                                                allocatedDuration:
                                                    originalConfig.allocatedDuration ||
                                                    0,
                                                updatedAt: now,
                                            });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Import Mappings (cMDA)
        if (Array.isArray(mappings)) {
            for (const mapping of mappings) {
                const newModuleId = moduleIdMap[mapping.moduleId];
                const newDayId = dayIdMap[mapping.dayId];
                if (!newModuleId || !newDayId) continue;

                const newEventId = mapping.eventId
                    ? eventIdMap[mapping.eventId]
                    : null;

                await tx.insert(ganttCurriculumEventDayMappingsSchema).values({
                    id: crypto.randomUUID(),
                    curriculumId: newCurriculumId,
                    moduleId: newModuleId,
                    eventId: newEventId,
                    dayId: newDayId,
                    sortOrder: mapping.sortOrder || 0,
                    createdAt: now,
                    updatedAt: now,
                });
            }
        }

        // 5. Import Constraints
        if (Array.isArray(constraints)) {
            for (const constraint of constraints) {
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

                // Validated like a create so a bad enum (type/relation) is a
                // 400 naming the field rather than a raw PostgresError.
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

        return newCurriculum;
    });

    // Convert Dates to strings to match frontend client expectations for response data
    const responseData = {
        ...result,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
    };

    return ApiSuccess(responseData);
});
