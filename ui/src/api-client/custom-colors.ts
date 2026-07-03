import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiCustomColorCreatePayload,
    ApiCustomColorCreateResponse,
    ApiCustomColorDeletePayload,
    ApiCustomColorDeleteResponse,
    ApiCustomColorsGetResponse,
    ApiCustomColorUpdatePayload,
    ApiCustomColorUpdateResponse,
} from "@/api-shared/types/custom-color";

type ClientApiGetCustomColors = ClientApiNoPayload<ApiCustomColorsGetResponse>;
type ClientApiCreateCustomColor = ClientApi<
    ApiCustomColorCreatePayload,
    ApiCustomColorCreateResponse
>;
type ClientApiUpdateCustomColor = ClientApi<
    ApiCustomColorUpdatePayload,
    ApiCustomColorUpdateResponse
>;
type ClientApiDeleteCustomColor = ClientApi<
    ApiCustomColorDeletePayload,
    ApiCustomColorDeleteResponse
>;

export const apiGetCustomColors: ClientApiGetCustomColors = async (props) => {
    return await safeApiFetcher<ApiCustomColorsGetResponse>(
        "/api/custom-colors",
        props,
    );
};

export const apiCreateCustomColor: ClientApiCreateCustomColor = async (
    color,
    props,
) => {
    return await safeApiFetcher<ApiCustomColorCreateResponse>("/api/custom-colors", {
        ...props,
        method: "PUT",
        body: JSON.stringify(color),
    });
};

export const apiUpdateCustomColor: ClientApiUpdateCustomColor = async (
    color,
    props,
) => {
    return await safeApiFetcher<ApiCustomColorUpdateResponse>("/api/custom-colors", {
        ...props,
        method: "POST",
        body: JSON.stringify(color),
    });
};

export const apiDeleteCustomColor: ClientApiDeleteCustomColor = async (
    colorId,
    props,
) => {
    await safeApiFetcher<ApiCustomColorDeleteResponse>("/api/custom-colors", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(colorId),
    });
};
