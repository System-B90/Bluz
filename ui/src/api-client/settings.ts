import { safeApiFetcher } from "@/api-client/common";

export async function apiGetSetting<T>(name: string)
{
    return (await safeApiFetcher(`/api/settings/${name}`)) as T;

}
export async function apiSetSetting<T>(name: string, value: T)
{
    (await safeApiFetcher(`/api/settings/${name}`, {
        method: 'POST',
        body: JSON.stringify(value)
    }));

}
