import { safeApiFetcher } from "@/api-client/common";
import {
    ApiSettingGetResponse,
    ApiSettingUpdatePayload,
    ApiSettingUpdateResponse,
} from "@/api-shared/types/settings/settings";

export async function apiGetSetting<T = ApiSettingGetResponse>(name: string, props?: any): Promise<T> {
    return await safeApiFetcher<T>(`/api/settings/${name}`, props);
}

export async function apiSetSetting<T = ApiSettingUpdatePayload>(name: string, value: T, props?: any): Promise<ApiSettingUpdateResponse> {
    await safeApiFetcher<ApiSettingUpdateResponse>(`/api/settings/${name}`, {
        ...props,
        method: "POST",
        body: JSON.stringify(value),
    });
}
