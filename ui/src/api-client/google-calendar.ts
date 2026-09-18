import {
    ClientApi,
    ClientApiNoPayload,
    safeApiFetcher,
} from "@/api-client/common";
import {
    ApiGoogleCalendarConnectPayload,
    ApiGoogleCalendarListResponse,
    ApiGoogleCalendarPurgePayload,
    ApiGoogleCalendarPurgeResponse,
    ApiGoogleCalendarSelectPayload,
    ApiGoogleCalendarSelectResponse,
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

/** Calendars the connected account can mirror into (own + shared with write access). */
export const apiListGoogleCalendars: ClientApiNoPayload<
    ApiGoogleCalendarListResponse
> = async (props) => {
    return await safeApiFetcher<ApiGoogleCalendarListResponse>(
        "/api/integrations/google-calendar/calendars",
        props,
    );
};

/** Re-points the link at an existing calendar, or a fresh Bluz-created one. */
export const apiSelectGoogleCalendar: ClientApi<
    ApiGoogleCalendarSelectPayload,
    ApiGoogleCalendarSelectResponse
> = async (payload, props) => {
    return await safeApiFetcher<ApiGoogleCalendarSelectResponse>(
        "/api/integrations/google-calendar/calendars",
        { ...props, method: "POST", body: JSON.stringify(payload) },
    );
};

/** Removes Bluz-tagged events from the linked calendar (orphans, or all). */
export const apiPurgeGoogleCalendar: ClientApi<
    ApiGoogleCalendarPurgePayload,
    ApiGoogleCalendarPurgeResponse
> = async (payload, props) => {
    return await safeApiFetcher<ApiGoogleCalendarPurgeResponse>(
        "/api/integrations/google-calendar/purge",
        { ...props, method: "POST", body: JSON.stringify(payload) },
    );
};
