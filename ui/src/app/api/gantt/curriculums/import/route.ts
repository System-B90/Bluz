import crypto from "crypto";

import { NextRequest } from "next/server";

import { ApiSuccess, withApi } from "@/api-server/common";
import { postgresDb } from "@/api-server/gantt";
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
    const body = await request.json();
    const { curriculum, mappings, constraints } = body;

    if (!curriculum || !curriculum.title) {
        throw new ClientApiError("שגיאה: נתוני גאנט לא תקינים.");
    }

    if (
        countImportNodes(curriculum, mappings, constraints) >
            MAX_IMPORT_NODES
    ) {
        throw new ClientApiError(
            "שגיאה: קובץ הייבוא גדול מדי.",
        );
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
                            totalWorkingMinutes: oldDay.totalWorkingMinutes || 0,
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
                await tx.insert(ganttSyllabusesSchema).values({
                    id: newSyllabusId,
                    title: oldSyllabus.title,
                    hiveIds: oldSyllabus.hiveIds || [],
                    createdAt: now,
                    updatedAt: now,
                });

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

                        await tx.insert(ganttModulesSchema).values({
                            id: newModuleId,
                            title: oldModule.title,
                            description: oldModule.description || "",
                            hiveIds: oldModule.hiveIds || [],
                            createdAt: now,
                            updatedAt: now,
                        });

                        await tx.insert(ganttSyllabus2ModulesSchema).values({
                            syllabusId: newSyllabusId,
                            moduleId: newModuleId,
                        });

                        if (Array.isArray(oldModule.m2e)) {
                            for (const m2eItem of oldModule.m2e) {
                                const oldEvent = m2eItem.event;
                                if (!oldEvent) continue;

                                const newEventId = `e_${crypto.randomUUID()}`;
                                eventIdMap[oldEvent.id] = newEventId;

                                await tx.insert(ganttEventsSchema).values({
                                    id: newEventId,
                                    title: oldEvent.title,
                                    type: oldEvent.type,
                                    minimumDuration: oldEvent.minimumDuration || 0,
                                    createdAt: now,
                                    updatedAt: now,
                                });

                                await tx.insert(ganttModule2EventsSchema).values({
                                    moduleId: newModuleId,
                                    eventId: newEventId,
                                });

                                // Extract and save event configurations (cEC)
                                if (Array.isArray(oldEvent.cEC)) {
                                    const originalConfig = oldEvent.cEC.find(
                                        (cfg: { curriculumId: string }) =>
                                            cfg.curriculumId === oldCurriculumId,
                                    );
                                    if (originalConfig) {
                                        await tx
                                            .insert(ganttCurriculumEventConfigurationsSchema)
                                            .values({
                                                curriculumId: newCurriculumId,
                                                eventId: newEventId,
                                                allocatedDuration: originalConfig.allocatedDuration || 0,
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

                const newEventId = mapping.eventId ? eventIdMap[mapping.eventId] : null;

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

                await tx.insert(ganttConstraintsSchema).values({
                    id: crypto.randomUUID(),
                    type: constraint.type,
                    ownerEventId,
                    ownerModuleId,
                    relation: constraint.relation || null,
                    targetEventId,
                    targetModuleId,
                    minDelayDays: constraint.minDelayDays || null,
                    maxDelayDays: constraint.maxDelayDays || null,
                    allowedDays: constraint.allowedDays || null,
                    forbiddenDays: constraint.forbiddenDays || null,
                    createdAt: now,
                    updatedAt: now,
                });
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
