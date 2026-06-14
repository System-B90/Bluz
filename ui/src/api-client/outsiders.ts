import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiOutsiderCreatePayload,
    ApiOutsiderCreateResponse,
    ApiOutsiderDeletePayload,
    ApiOutsiderDeleteResponse,
    ApiOutsidersGetResponse,
    ApiOutsiderUpdatePayload,
    ApiOutsiderUpdateResponse,
} from "@/api-shared/types/outsider";

type ClientApiGetOutsiders = ClientApiNoPayload<ApiOutsidersGetResponse>;
type ClientApiCreateOutsider = ClientApi<
  ApiOutsiderCreatePayload,
  ApiOutsiderCreateResponse
>;
type ClientApiUpdateOutsider = ClientApi<
  ApiOutsiderUpdatePayload,
  ApiOutsiderUpdateResponse
>;
type ClientApiDeleteOutsider = ClientApi<
  ApiOutsiderDeletePayload,
  ApiOutsiderDeleteResponse
>;

export const apiGetOutsiders: ClientApiGetOutsiders = async (props) => {
    return await safeApiFetcher<ApiOutsidersGetResponse>("/api/outsiders", props);
};

export const apiCreateOutsider: ClientApiCreateOutsider = async (
    outsider,
    props,
) => {
    return await safeApiFetcher<ApiOutsiderCreateResponse>("/api/outsiders", {
        ...props,
        method: "PUT",
        body: JSON.stringify(outsider),
    });
};

export const apiUpdateOutsider: ClientApiUpdateOutsider = async (
    outsider,
    props,
) => {
    return await safeApiFetcher<ApiOutsiderUpdateResponse>("/api/outsiders", {
        ...props,
        method: "POST",
        body: JSON.stringify(outsider),
    });
};

export const apiDeleteOutsider: ClientApiDeleteOutsider = async (
    outsiderId,
    props,
) => {
    await safeApiFetcher<ApiOutsiderDeleteResponse>("/api/outsiders", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(outsiderId),
    });
};
