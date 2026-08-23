import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { iterationEndpoint } from "@/api-client/iteration-query";
import { IterationId } from "@/api-shared/types/iteration";
import {
    ApiSettingGetResponse,
    ApiSettingUpdatePayload,
    ApiSettingUpdateResponse,
} from "@/api-shared/types/settings/settings";

/**
 * Settings live in the iteration's own database, so every read carries the
 * active iteration. An absent id means the current (writable) run.
 */
export async function apiGetSetting<T = ApiSettingGetResponse>(
    name: string,
    iterationId?: IterationId,
    props?: ClientApiProps,
): Promise<T> {
    return await safeApiFetcher<T>(
        iterationEndpoint(`/api/settings/${encodeURIComponent(name)}`, iterationId),
        props,
    );
}

export async function apiSetSetting<T = ApiSettingUpdatePayload>(
    name: string,
    value: T,
    iterationId?: IterationId,
    props?: ClientApiProps,
): Promise<ApiSettingUpdateResponse> {
    return await safeApiFetcher<ApiSettingUpdateResponse>(
        iterationEndpoint(`/api/settings/${encodeURIComponent(name)}`, iterationId),
        {
            ...props,
            method: "POST",
            body: JSON.stringify(value),
        },
    );
}
