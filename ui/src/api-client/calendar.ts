import { ClientApi, safeApiFetcher } from "@/api-client/common";
import { eventDateFixup } from "@/api-shared/calendar";
import {
    ApiEventCreatePayload,
    ApiEventCreateResponse,
    ApiEventDeletePayload,
    ApiEventDeleteResponse,
    ApiEventUpdatePayload,
    ApiEventUpdateResponse,
    DbEventDocument,
    Event,
    EventId,
} from "@/api-shared/types/event";

type ClientApiGetEventsProps = { startDate?: Date; endDate?: Date };
export async function apiGetEvents({
    startDate,
    endDate,
}: ClientApiGetEventsProps): Promise<Array<Event>> {
    const endpoint = new URL("/api/event", window.location.origin);
    endpoint.searchParams.set("sd", startDate?.toISOString() ?? "");
    endpoint.searchParams.set("ed", endDate?.toISOString() ?? "");
    const rawData = await safeApiFetcher<Array<DbEventDocument>>(endpoint.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    return rawData.map(eventDateFixup) as unknown as Array<Event>;
}

export async function apiGetMultipleEvents(
    eventIds: Array<EventId>,
): Promise<Record<EventId, Event>> {
    const endpoint = new URL("/api/event", window.location.origin);
    endpoint.searchParams.set("ids", eventIds.join(","));
    const rawData = await safeApiFetcher<Record<EventId, DbEventDocument>>(
        endpoint.toString(),
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        },
    );
    for (const key of Object.keys(rawData)) {
        eventDateFixup(rawData[key]);
    }
    return rawData as unknown as Record<EventId, Event>;
}

type ClientApiCreateEvent = ClientApi<ApiEventCreatePayload | Event, Event>;
export const apiCreateEvent: ClientApiCreateEvent = async (event, props) => {
    const rawData = await safeApiFetcher<ApiEventCreateResponse>("/api/event", {
        ...props,
        method: "PUT",
        body: JSON.stringify(event),
    });
    return eventDateFixup(rawData) as unknown as Event;
};

type ClientApiUpdateEvent = ClientApi<ApiEventUpdatePayload | Event, Event>;
export const apiUpdateEvent: ClientApiUpdateEvent = async (event, props) => {
    const rawData = await safeApiFetcher<ApiEventUpdateResponse>("/api/event", {
        ...props,
        method: "POST",
        body: JSON.stringify(event),
    });
    return eventDateFixup(rawData) as unknown as Event;
};

type ClientApiDeleteEvent = ClientApi<ApiEventDeletePayload, ApiEventDeleteResponse>;
export const apiDeleteEvent: ClientApiDeleteEvent = async (eventId, props) => {
    await safeApiFetcher<ApiEventDeleteResponse>("/api/event", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(eventId),
    });
};
