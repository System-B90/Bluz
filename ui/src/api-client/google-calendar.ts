import { ClientApiNoPayload, safeApiFetcher } from "@/api-client/common";
import {
    ApiGoogleCalendarConnectResponse,
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

export const apiGetGoogleCalendarConnectUrl: ClientApiNoPayload<
    ApiGoogleCalendarConnectResponse
> = async (props) => {
    return await safeApiFetcher<ApiGoogleCalendarConnectResponse>(
        "/api/integrations/google-calendar/connect",
        props,
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
