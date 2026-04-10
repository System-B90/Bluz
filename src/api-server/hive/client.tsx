import { Class, CourseUser } from "@/api-server/hive/types";
import { ClientApiError, HiveError } from "@/api-shared/errors";
import { Module } from "@/components/schedule/types/module";
import { HiveRoom, RoomSource } from "@/components/schedule/types/room";
import { Subject } from "@/components/schedule/types/subject";

interface TimeoutError extends Error
{
    name: 'TypeError';
    cause: {
        name: string;
        [ key: string ]: unknown;
    };
}

export function isTimeoutError(e: unknown): e is TimeoutError
{
    return (e instanceof Error)
        && (e.name === 'TypeError')
        && ('cause' in e)
        && (typeof e.cause === 'object')
        && (e.cause !== null)
        && ('name' in e.cause)
        && (typeof (e.cause as Record<string, unknown>).name === 'string');
}

class HiveClient
{
    initialized: boolean;
    _initError: boolean;
    accessToken!: string;
    refreshTokenValue!: string;
    _username!: string;
    _password!: string;

    buildUrl(path: string): string
    {
        return `${process.env.NEXT_PUBLIC_HIVE_URL}${path}`;
    }

    constructor(username: string, password: string)
    {
        this.initialized = false;
        this._initError = false;
        this._username = username;
        this._password = password;
    }

    async refreshToken(): Promise<void>
    {
        const response = await fetch(this.buildUrl('/api/core/token/refresh/'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh: this.refreshTokenValue
            })
        }).catch((e) =>
        {
            if (isTimeoutError(e))
            {
                throw new HiveError(e.cause.name);
            }
            throw e;
        });
        if (!response.ok)
        {
            throw new HiveError('Failed to refresh token');
        }
        const data = await response.json();
        this.accessToken = data.access;
        this.refreshTokenValue = data.refresh;
    }

    async initialize(): Promise<void>
    {
        if (this.initialized) return;
        const url = this.buildUrl('/api/core/token/');
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: this._username,
                password: this._password
            })
        }).catch((e: unknown) =>
        {
            this._initError = true;
            if (isTimeoutError(e))
            {
                throw new HiveError(e.cause.name);
            }
            throw e;
        }).then((response) =>
        {
            if (!response.ok)
            {
                throw new HiveError('Failed to authenticate with Hive');
            }
            return response.json();
        }).then((data: { access: string, refresh: string; }) =>
        {
            this.accessToken = data.access;
            this.refreshTokenValue = data.refresh;
            this.initialized = true;
        });
    }

    async isInitialized(): Promise<void>
    {
        if (this.initialized) return;
        return new Promise<void>((resolve, reject) =>
        {
            const check = () =>
            {
                if (this.initialized)
                {
                    resolve();
                } else
                {
                    if (this._initError)
                    {
                        reject();
                    }
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    async _get<T>(url: string): Promise<T>
    {
        await this.isInitialized();

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            }

        }).catch((e) =>
        {
            if (isTimeoutError(e))
            {
                throw new HiveError(e.cause.name);
            }
            throw e;
        });

        if (response.status === 401)
        {
            // Handle token expiration
            await this.refreshToken();
            return this._get(url);
        }
        if (response.status === 500)
        {
            // Retry after a short delay
            console.warn('Server error, retrying...');
            await new Promise(resolve => setTimeout(resolve, 200));
            return this._get(url);
        }
        if (!response.ok)
        {
            console.error(`Failed to fetch data from ${url}:`, response.statusText);
            console.error('Response body:', await response.json());
            throw new HiveError('Failed to fetch data from Hive');
        }
        return response.json();
    }

    async getUsers(params?: Record<string, any>): Promise<Array<CourseUser>>
    {
        const queryString = new URLSearchParams(params).toString();
        return this._get<Array<CourseUser>>(this.buildUrl(`/api/core/management/users/?${queryString}`));
    }

    async getClasses(): Promise<Array<Class>>
    {
        return this._get<Array<Class>>(this.buildUrl('/api/core/management/classes/?type=Student%20Group'));
    }

    async getRooms(): Promise<Array<HiveRoom>>
    {
        return (await this._get<Array<HiveRoom>>(this.buildUrl('/api/core/management/classes/?type=Room'))).map((r) => ({ ...r, source: RoomSource.Hive }));
    }

    async getSubjects(): Promise<Array<Subject>>
    {
        return this._get<Array<Subject>>(this.buildUrl('/api/core/course/subjects/'));
    }

    async getModules(): Promise<Array<Module>>
    {
        return this._get<Array<Module>>(this.buildUrl('/api/core/course/modules/'));
    }
}

let _hiveClient: HiveClient | null = null;
export async function getHiveClient(): Promise<HiveClient>
{
    if (_hiveClient !== null) return _hiveClient;

    const username = process.env.HIVE_USERNAME;
    const password = process.env.HIVE_PASSWORD;

    if (!username || !password)
    {
        throw new HiveError("HIVE_USERNAME and HIVE_PASSWORD must be defined in environment variables.");
    }

    const newHiveClient = new HiveClient(username, password);
    try
    {
        await newHiveClient.initialize();
    } catch (e: unknown)
    {
        console.error('[FATAL] Failed to initialize HiveClient!', e);
        throw e;
    }

    _hiveClient = newHiveClient;
    return _hiveClient;
}
