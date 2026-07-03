import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiPersonalSettingsGetResponse,
    ApiPersonalSettingsSetPayload,
    ApiPersonalSettingsSetResponse,
} from "@/api-shared/types/personal-settings";

type ClientApiGetPersonalSettings =
    ClientApiNoPayload<ApiPersonalSettingsGetResponse>;
type ClientApiSetPersonalSettings = ClientApi<
    ApiPersonalSettingsSetPayload,
    ApiPersonalSettingsSetResponse
>;

export const apiGetPersonalSettings: ClientApiGetPersonalSettings = async (
    props,
) => {
    return await safeApiFetcher<ApiPersonalSettingsGetResponse>(
        "/api/personal-settings",
        props,
    );
};

export const apiSetPersonalSettings: ClientApiSetPersonalSettings = async (
    settings,
    props,
) => {
    return await safeApiFetcher<ApiPersonalSettingsSetResponse>(
        "/api/personal-settings",
        {
            ...props,
            method: "POST",
            body: JSON.stringify(settings),
        },
    );
};
