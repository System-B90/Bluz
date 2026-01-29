import { Class, CourseUser } from "@/api-server/hive/types";
import { HiveError } from "@/api-shared/errors";
import { Module } from "@/components/schedule/types/module";
import { Subject } from "@/components/schedule/types/subject";

class HiveClient
{
    initialized: boolean;
    accessToken!: string;
    refreshTokenValue!: string;
    _username!: string;
    _password!: string;

    buildUrl(path: string): string
    {
        return `${process.env.NEXT_PUBLIC_HIVE_API_URL}${path}`;
    }

    constructor(username: string, password: string)
    {
        this.initialized = false;
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
        return new Promise<void>((resolve) =>
        {
            const check = () =>
            {
                if (this.initialized)
                {
                    resolve();
                } else
                {
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
        return this._get<Array<Class>>(this.buildUrl('/api/core/management/classes/'));
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
    await newHiveClient.initialize();

    _hiveClient = newHiveClient;
    return _hiveClient;
}
