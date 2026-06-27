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
import { IterationId } from "@/api-shared/types/iteration";

/** Append the active iteration to a request, when one is selected. */
function withIteration(endpoint: URL, iterationId?: IterationId): URL {
    if (iterationId) {
        endpoint.searchParams.set("it", iterationId);
    }
    return endpoint;
}

type ClientApiGetEventsProps = {
    startDate?: Date;
    endDate?: Date;
    iterationId?: IterationId;
};
export async function apiGetEvents({
    startDate,
    endDate,
    iterationId,
}: ClientApiGetEventsProps): Promise<Array<Event>> {
    const endpoint = withIteration(
        new URL("/api/event", window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("sd", startDate?.toISOString() ?? "");
    endpoint.searchParams.set("ed", endDate?.toISOString() ?? "");
    const rawData = await safeApiFetcher<Array<DbEventDocument>>(
        endpoint.toString(),
        {
            method: "GET",
        },
    );
    return rawData.map(eventDateFixup) as unknown as Array<Event>;
}

export async function apiGetMultipleEvents(
    eventIds: Array<EventId>,
    iterationId?: IterationId,
): Promise<Record<EventId, Event>> {
    const endpoint = withIteration(
        new URL("/api/event", window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("ids", eventIds.join(","));
    const rawData = await safeApiFetcher<Record<EventId, DbEventDocument>>(
        endpoint.toString(),
        {
            method: "GET",
        },
    );
    for (const key of Object.keys(rawData)) {
        rawData[key] = eventDateFixup(rawData[key]);
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

type ClientApiDeleteEvent = ClientApi<
    ApiEventDeletePayload,
    ApiEventDeleteResponse
>;
export const apiDeleteEvent: ClientApiDeleteEvent = async (eventId, props) => {
    await safeApiFetcher<ApiEventDeleteResponse>("/api/event", {
        ...props,
        method: "DELETE",
        body: JSON.stringify(eventId),
    });
};

/**
 * Fetch the events of two iterations over the same date range in one round-trip,
 * for side-by-side / week comparison views.
 */
export async function apiCompareEvents({
    startDate,
    endDate,
    iterationA,
    iterationB,
}: {
    startDate: Date;
    endDate: Date;
    iterationA?: IterationId;
    iterationB?: IterationId;
}): Promise<{ a: Array<Event>; b: Array<Event> }> {
    const endpoint = new URL("/api/event/compare", window.location.origin);
    endpoint.searchParams.set("sd", startDate.toISOString());
    endpoint.searchParams.set("ed", endDate.toISOString());
    if (iterationA) endpoint.searchParams.set("itA", iterationA);
    if (iterationB) endpoint.searchParams.set("itB", iterationB);

    const rawData = await safeApiFetcher<{
        a: Array<DbEventDocument>;
        b: Array<DbEventDocument>;
    }>(endpoint.toString(), {
        method: "GET",
    });
    return {
        a: rawData.a.map(eventDateFixup) as unknown as Array<Event>,
        b: rawData.b.map(eventDateFixup) as unknown as Array<Event>,
    };
}
