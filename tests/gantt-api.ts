import { APIRequestContext } from "@playwright/test";

import { expect } from "./fixtures";

/** Gantt REST helpers shared by the API-driven specs. Wire shapes are raw (`s2m`/`m2e`). */

export type Json = Record<string, unknown>;

export async function apiJson<T = Json>(
    response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
    const body = await response.json();
    expect(body.status, `API error: ${JSON.stringify(body.error ?? body)}`).toBe(0);
    return body.data as T;
}

export function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

export async function createCurriculum(request: APIRequestContext, tag: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/curriculums", {
            data: {
                description: tag,
                isArchived: false,
                isDraft: true,
                startDate: upcomingSunday(),
                title: `${tag}-${Date.now()}`,
            },
        }),
    );
    return id;
}

export async function createSyllabus(request: APIRequestContext, curriculumId: string, title = "e2e-syllabus"): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/syllabuses", {
            data: { curriculumId, hiveIds: [], title },
        }),
    );
    return id;
}

export async function createModule(request: APIRequestContext, syllabusId: string, title: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/modules", {
            data: { description: "", hiveIds: [], syllabusId, title },
        }),
    );
    return id;
}

export async function createEvent(request: APIRequestContext, moduleId: string, title: string): Promise<string> {
    const { id } = await apiJson<{ id: string }>(
        await request.post("/api/gantt/events", {
            data: {
                allocatedDuration: 60,
                comment: null,
                hiveLessonId: null,
                hiveModuleId: null,
                hiveSubjectId: null,
                isCritical: false,
                isPaWindow: false,
                minimumDuration: 60,
                moduleId,
                orchestratorId: null,
                recommendedLecturerIds: [],
                recurrence: "none",
                roomRequirement: "בחוץ",
                splitAcrossBreaks: false,
                systemRequirements: [],
                title,
                type: "הרצאה",
            },
        }),
    );
    return id;
}

export type RawModule = { m2e: Array<{ eventId: string }> };
export type RawSyllabus = { s2m: Array<{ moduleId: string; module: RawModule }> };

export async function moduleOrder(request: APIRequestContext, syllabusId: string): Promise<Array<string>> {
    const syllabus = await apiJson<RawSyllabus>(await request.get(`/api/gantt/syllabuses/${syllabusId}`));
    return syllabus.s2m.map((row) => row.moduleId);
}

export async function eventOrder(request: APIRequestContext, moduleId: string): Promise<Array<string>> {
    const module = await apiJson<RawModule>(await request.get(`/api/gantt/modules/${moduleId}`));
    return module.m2e.map((row) => row.eventId);
}

export async function curriculumOrders(
    request: APIRequestContext,
    curriculumId: string,
    syllabusId: string,
    moduleId: string,
): Promise<{ modules: Array<string>; events: Array<string> }> {
    const curriculum = await apiJson<{ c2s: Array<{ syllabusId: string; syllabus: RawSyllabus }> }>(
        await request.get(`/api/gantt/curriculums/${curriculumId}`),
    );
    const syllabus = curriculum.c2s.find((row) => row.syllabusId === syllabusId)?.syllabus;
    const s2m = syllabus?.s2m ?? [];
    return {
        events: s2m.find((row) => row.moduleId === moduleId)?.module.m2e.map((row) => row.eventId) ?? [],
        modules: s2m.map((row) => row.moduleId),
    };
}

export async function reorderModules(request: APIRequestContext, syllabusId: string, moduleIds: Array<string>) {
    await apiJson(
        await request.post(`/api/gantt/syllabuses/${syllabusId}/reorder-modules`, {
            data: { moduleIds },
        }),
    );
}

export async function reorderEvents(request: APIRequestContext, moduleId: string, eventIds: Array<string>) {
    await apiJson(
        await request.post(`/api/gantt/modules/${moduleId}/reorder-events`, {
            data: { eventIds },
        }),
    );
}

