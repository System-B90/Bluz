import { HiveClientError } from "@/api-shared/errors";
import {
    Class,
    CourseUser,
    Lesson,
    LessonRequest,
    LessonRule,
    LessonRuleRequest,
} from "@/api-shared/types/hive";
import { Module } from "@/api-shared/types/module";
import { HiveRoom, RoomSource } from "@/api-shared/types/room";
import { Subject } from "@/api-shared/types/subject";

type TimeoutError = {
    name: "TypeError";
    cause: {
        name: string;
        [key: string]: unknown;
    };
} & Error;

export function isTimeoutError(e: unknown): e is TimeoutError {
    return (
        e instanceof Error &&
        e.name === "TypeError" &&
        "cause" in e &&
        typeof e.cause === "object" &&
        e.cause !== null &&
        "name" in e.cause &&
        typeof (e.cause as Record<string, unknown>).name === "string"
    );
}

export class HiveClient {
    private accessToken: string;
    private refreshTokenValue?: string;

    constructor(accessToken: string, refreshToken?: string) {
        this.accessToken = accessToken;
        this.refreshTokenValue = refreshToken;
    }

    private buildUrl(path: string): string {
        return `${process.env.NEXT_PUBLIC_HIVE_URL}${path}`;
    }

    private async refreshAccessToken(): Promise<void> {
        if (!this.refreshTokenValue) {
            throw new HiveClientError("אין טוקן רפרש זמין, אנא התחבר מחדש");
        }

        const response = await fetch(
            this.buildUrl("/api/core/token/refresh/"),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    refresh: this.refreshTokenValue,
                }),
            },
        );

        if (!response.ok) {
            throw new HiveClientError("עדכון הטוקן נכשל, אנא התחבר מחדש");
        }

        const data = await response.json();
        this.accessToken = data.access;

        if (data.refresh) {
            this.refreshTokenValue = data.refresh;
        }
    }

    private async _request<T>(
        url: string,
        method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
        body?: unknown,
        isRetry = false,
        retryCount = 0,
    ): Promise<T> {
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (response.status === 401) {
            if (!isRetry && this.refreshTokenValue) {
                await this.refreshAccessToken();
                return await this._request<T>(url, method, body, true, 0);
            }
            throw new HiveClientError("הטוקן אינו תקף, אנא התחבר מחדש");
        }

        if (response.status === 500) {
            if (retryCount >= 3) {
                throw new HiveClientError(
                    `שגיאה בשרת הייב לאחר ${retryCount} ניסיונות: ${response.statusText}`,
                );
            }
            await new Promise((resolve) =>
                setTimeout(resolve, 200 * Math.pow(2, retryCount)),
            );
            return await this._request<T>(url, method, body, isRetry, retryCount + 1);
        }

        if (!response.ok) {
            throw new HiveClientError(
                `פעולה מול הייב נכשלה: ${response.statusText}`,
            );
        }

        if (response.status === 204) {
            return undefined as T;
        }

        const text = await response.text();
        return text ? JSON.parse(text) : (undefined as T);
    }

    private async _get<T>(
        url: string,
        isRetry = false,
        retryCount = 0,
    ): Promise<T> {
        return await this._request<T>(url, "GET", undefined, isRetry, retryCount);
    }

    /**
     * Hive-hosted services such as Prometheus expect `Cookie: token=<access_token>`
     * instead of (or in addition to) Bearer auth.
     */
    async fetchWithTokenCookie(
        url: string,
        init: RequestInit = {},
        isRetry = false,
    ): Promise<Response> {
        const headers = new Headers(init.headers);
        headers.set("Cookie", `token=${this.accessToken}`);

        const response = await fetch(url, {
            ...init,
            headers,
        });

        if (response.status === 401) {
            if (!isRetry && this.refreshTokenValue) {
                await this.refreshAccessToken();
                return await this.fetchWithTokenCookie(url, init, true);
            }
        }

        return response;
    }

    async getUsers(params?: Record<string, any>): Promise<Array<CourseUser>> {
        const queryString = new URLSearchParams(params).toString();
        return await this._get<Array<CourseUser>>(
            this.buildUrl(`/api/core/management/users/?${queryString}`),
        );
    }

    async getClasses(): Promise<Array<Class>> {
        return await this._get<Array<Class>>(
            this.buildUrl("/api/core/management/classes/?type=Student%20Group"),
        );
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
