import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiGoogleCalendarConnectPayload,
    ApiGoogleCalendarStatusResponse,
    ApiGoogleCalendarSyncResponse,
} from "@/api-shared/types/google-calendar";

export const apiGetGoogleCalendarStatus: ClientApiNoPayload<
    ApiGoogleCalendarStatusResponse
> = async (props) => {
    return await safeApiFetcher<ApiGoogleCalendarStatusResponse>(
        "/api/integrations/google-calendar/status",
        props,
    );
};

/** Sends the GIS popup's authorization code to the server for token exchange. */
export const apiConnectGoogleCalendar: ClientApi<
    ApiGoogleCalendarConnectPayload,
    void
> = async (payload, props) => {
    return await safeApiFetcher<void>(
        "/api/integrations/google-calendar/connect",
        { ...props, method: "POST", body: JSON.stringify(payload) },
    );
};

export const apiDisconnectGoogleCalendar: ClientApiNoPayload<void> = async (
    props,
) => {
    return await safeApiFetcher<void>(
        "/api/integrations/google-calendar/disconnect",
        { ...props, method: "POST" },
    );
};

export const apiSyncGoogleCalendarNow: ClientApiNoPayload<
    ApiGoogleCalendarSyncResponse
> = async (props) => {
    return await safeApiFetcher<ApiGoogleCalendarSyncResponse>(
        "/api/integrations/google-calendar/sync",
        { ...props, method: "POST" },
    );
};
