import {
    ClassTypeEnum,
    HiveClient as HiveClientBase,
} from "@system-b90/hive-core";

import {
    Class,
    HiveLesson,
    HiveLessonId,
    LessonRequest,
    LessonRule,
    LessonRuleRequest,
    Queue,
} from "@/api-shared/types/hive";
import { Module } from "@/api-shared/types/module";
import { HiveRoom, RoomSource } from "@/api-shared/types/room";
import { Subject } from "@/api-shared/types/subject";

export { isTimeoutError } from "@system-b90/hive-core";

/**
 * Hive's lesson serializer names the module foreign key `module_id`; older
 * instances (and `@system-b90/hive-core`'s types) call it `module`. Sending
 * both satisfies either one — DRF ignores the field it does not declare —
 * so Bluz does not have to know which Hive it is talking to.
 */
function withModuleId(
    data: Partial<LessonRequest>,
): Partial<LessonRequest> & { module_id?: number } {
    return data.module === undefined
        ? data
        : { ...data, module_id: data.module };
}

/**
 * Bluz's Hive client: the request core (token refresh, 401 retry, 500
 * backoff, cookie-auth fetch, users/classes) lives in
 * `@system-b90/hive-core`; this subclass adds the scheduling endpoints.
 */
export class HiveClient extends HiveClientBase {
    override async getClasses(): Promise<Array<Class>> {
        return await super.getClasses(ClassTypeEnum.Student_Group);
    }

    async getRooms(): Promise<Array<HiveRoom>> {
        return (
            await this._get<Array<HiveRoom>>(
                this.buildUrl("/api/core/management/classes/?type=Room"),
            )
        ).map((r) => ({ ...r, source: RoomSource.Hive }));
    }

    async getSubjects(): Promise<Array<Subject>> {
        return await this._get<Array<Subject>>(
            this.buildUrl("/api/core/course/subjects/"),
        );
    }

    async getModules(): Promise<Array<Module>> {
        return await this._get<Array<Module>>(
            this.buildUrl("/api/core/course/modules/"),
        );
    }

    /**
     * The queues of one Hive module — the only queues a lesson rule may point
     * at (Hive rejects user queues on a rule).
     */
    async getModuleQueues(moduleId: number): Promise<Array<Queue>> {
        return await this._get<Array<Queue>>(
            this.buildUrl(`/api/core/queues/?module=${moduleId}`),
        );
    }

    async getLessons(params?: Record<string, any>): Promise<Array<HiveLesson>> {
        const queryString = new URLSearchParams(params).toString();
        return await this._request<Array<HiveLesson>>(
            this.buildUrl(`/api/core/schedule/lessons/?${queryString}`),
            "GET",
        );
    }

    async getLesson(id: HiveLessonId): Promise<HiveLesson> {
        return await this._request<HiveLesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "GET",
        );
    }

    async createLesson(data: LessonRequest): Promise<HiveLesson> {
        return await this._request<HiveLesson>(
            this.buildUrl("/api/core/schedule/lessons/"),
            "POST",
            withModuleId(data),
        );
    }

    async updateLesson(id: HiveLessonId, data: LessonRequest): Promise<HiveLesson> {
        return await this._request<HiveLesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "PUT",
            withModuleId(data),
        );
    }

    async patchLesson(
        id: HiveLessonId,
        data: Partial<LessonRequest>,
    ): Promise<HiveLesson> {
        return await this._request<HiveLesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "PATCH",
            withModuleId(data),
        );
    }

    async deleteLesson(id: HiveLessonId): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "DELETE",
        );
    }

    async setLessonForClass(classId: number, lessonId: HiveLessonId | null): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/management/classes/${classId}/lesson/`),
            "POST",
            { lesson: lessonId },
        );
    }

    async getLessonRules(parentId: HiveLessonId): Promise<Array<LessonRule>> {
        return await this._request<Array<LessonRule>>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/`),
            "GET",
        );
    }

    async getLessonRule(parentId: HiveLessonId, id: number): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "GET",
        );
    }

    async createLessonRule(parentId: HiveLessonId, data: LessonRuleRequest): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/`),
            "POST",
            data,
        );
    }

    async updateLessonRule(
        parentId: HiveLessonId,
        id: number,
        data: LessonRuleRequest,
    ): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "PUT",
            data,
        );
    }

    async patchLessonRule(
        parentId: HiveLessonId,
        id: number,
        data: Partial<LessonRuleRequest>,
    ): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "PATCH",
            data,
        );
    }

    async deleteLessonRule(parentId: HiveLessonId, id: number): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "DELETE",
        );
    }
}
