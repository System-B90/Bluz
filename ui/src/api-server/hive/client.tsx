import { HiveClientError } from "@/api-shared/errors";
import { Class, CourseUser } from "@/api-shared/types/hive";
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

    private async _get<T>(url: string, isRetry = false): Promise<T> {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (response.status === 401) {
            if (!isRetry && this.refreshTokenValue) {
                await this.refreshAccessToken();
                return await this._get<T>(url, true);
            }
            throw new HiveClientError("הטוקן אינו תקף, אנא התחבר מחדש");
        }

        if (response.status === 500) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return await this._get<T>(url, isRetry);
        }

        if (!response.ok) {
            throw new HiveClientError(
                `טעינת מידע מהייב נכשלה: ${response.statusText}`,
            );
        }

        return await response.json();
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
}
