import {
    ClassTypeEnum,
    HiveClient as HiveClientBase,
} from "@system-b15/hive-core";

import {
    Class,
    Lesson,
    LessonRequest,
    LessonRule,
    LessonRuleRequest,
} from "@/api-shared/types/hive";
import { Module } from "@/api-shared/types/module";
import { HiveRoom, RoomSource } from "@/api-shared/types/room";
import { Subject } from "@/api-shared/types/subject";

export { isTimeoutError } from "@system-b15/hive-core";

/**
 * Bluz's Hive client: the request core (token refresh, 401 retry, 500
 * backoff, cookie-auth fetch, users/classes) lives in
 * `@system-b15/hive-core`; this subclass adds the scheduling endpoints.
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

    async getLessons(params?: Record<string, any>): Promise<Array<Lesson>> {
        const queryString = new URLSearchParams(params).toString();
        return await this._request<Array<Lesson>>(
            this.buildUrl(`/api/core/schedule/lessons/?${queryString}`),
            "GET",
        );
    }

    async getLesson(id: number): Promise<Lesson> {
        return await this._request<Lesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "GET",
        );
    }

    async createLesson(data: LessonRequest): Promise<Lesson> {
        return await this._request<Lesson>(
            this.buildUrl("/api/core/schedule/lessons/"),
            "POST",
            data,
        );
    }

    async updateLesson(id: number, data: LessonRequest): Promise<Lesson> {
        return await this._request<Lesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "PUT",
            data,
        );
    }

    async patchLesson(id: number, data: Partial<LessonRequest>): Promise<Lesson> {
        return await this._request<Lesson>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "PATCH",
            data,
        );
    }

    async deleteLesson(id: number): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/schedule/lessons/${id}/`),
            "DELETE",
        );
    }

    async setLessonForClass(classId: number, lessonId: null | number): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/management/classes/${classId}/lesson/`),
            "POST",
            { lesson: lessonId },
        );
    }

    async getLessonRules(parentId: number): Promise<Array<LessonRule>> {
        return await this._request<Array<LessonRule>>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/`),
            "GET",
        );
    }

    async getLessonRule(parentId: number, id: number): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "GET",
        );
    }

    async createLessonRule(parentId: number, data: LessonRuleRequest): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/`),
            "POST",
            data,
        );
    }

    async updateLessonRule(
        parentId: number,
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
        parentId: number,
        id: number,
        data: Partial<LessonRuleRequest>,
    ): Promise<LessonRule> {
        return await this._request<LessonRule>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "PATCH",
            data,
        );
    }

    async deleteLessonRule(parentId: number, id: number): Promise<void> {
        return await this._request<void>(
            this.buildUrl(`/api/core/schedule/lessons/${parentId}/rules/${id}/`),
            "DELETE",
        );
    }
}
