import { ClientApiProps, safeApiFetcher } from "@/api-client/common";
import { withIteration } from "@/api-client/iteration-query";
import { eventDateFixupToDayjs } from "@/api-shared/calendar";
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
import {
    ApiEventHistoryResponse,
    EVENT_INITIATOR_HEADER,
    EventChangeInitiator,
} from "@/api-shared/types/event-history";
import { IterationId } from "@/api-shared/types/iteration";

type ClientApiGetEventsProps = {
    startDate: Date;
    endDate: Date;
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
    endpoint.searchParams.set("sd", startDate.toISOString());
    endpoint.searchParams.set("ed", endDate.toISOString());
    const rawData = await safeApiFetcher<Array<DbEventDocument>>(
        endpoint.toString(),
        {
            method: "GET",
        },
    );
    return rawData.map(eventDateFixupToDayjs);
}

/**
 * Fetches several events by id in one round-trip. The route
 * (`app/api/event/route.ts`) filters out malformed ids and silently omits
 * ids it can't find, so the response can carry fewer keys than
 * `eventIds` — the return type is `Partial<...>` precisely so every
 * caller has to handle a missing id instead of the old `Record<EventId,
 * Event>` signature promising a complete map it couldn't guarantee.
 */
export async function apiGetMultipleEvents(
    eventIds: Array<EventId>,
    iterationId?: IterationId,
): Promise<Partial<Record<EventId, Event>>> {
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
    const events: Partial<Record<EventId, Event>> = {};
    for (const key of Object.keys(rawData) as Array<EventId>) {
        events[key] = eventDateFixupToDayjs(rawData[key]);
    }
    return events;
}

/**
 * Declares which user action produced a write, so the server can log it in the
 * event change log (`api-server/db-event-history.ts`). Sent as a header rather
 * than in the body: the body is the event document itself, and DELETE carries
 * only an id. The server never trusts the client for *who* acted — only for
 * *what kind of action* this was.
 * @param props Caller-supplied request props to merge into.
 * @param initiator The action being performed; omitted ⇒ server logs "unknown".
 */
export function withInitiator(
    props: ClientApiProps | undefined,
    initiator?: EventChangeInitiator,
): ClientApiProps {
    if (!initiator) return props ?? {};
    const headers = new Headers(props?.headers);
    headers.set(EVENT_INITIATOR_HEADER, initiator);
    return { ...props, headers };
}

type ClientApiCreateEvent = (
    event: ApiEventCreatePayload | Event,
    initiator?: EventChangeInitiator,
    props?: ClientApiProps,
) => Promise<Event>;
export const apiCreateEvent: ClientApiCreateEvent = async (
    event,
    initiator,
    props,
) => {
    const rawData = await safeApiFetcher<ApiEventCreateResponse>("/api/event", {
        ...withInitiator(props, initiator),
        method: "PUT",
        body: JSON.stringify(event),
    });
    return eventDateFixupToDayjs(rawData);
};

type ClientApiUpdateEvent = (
    event: ApiEventUpdatePayload | Event,
    initiator?: EventChangeInitiator,
    props?: ClientApiProps,
) => Promise<Event>;
export const apiUpdateEvent: ClientApiUpdateEvent = async (
    event,
    initiator,
    props,
) => {
    const rawData = await safeApiFetcher<ApiEventUpdateResponse>("/api/event", {
        ...withInitiator(props, initiator),
        method: "POST",
        body: JSON.stringify(event),
    });
    return eventDateFixupToDayjs(rawData);
};

type ClientApiDeleteEvent = (
    eventId: ApiEventDeletePayload,
    initiator?: EventChangeInitiator,
    props?: ClientApiProps,
) => Promise<ApiEventDeleteResponse>;
export const apiDeleteEvent: ClientApiDeleteEvent = async (
    eventId,
    initiator,
    props,
) => {
    await safeApiFetcher<ApiEventDeleteResponse>("/api/event", {
        ...withInitiator(props, initiator),
        method: "DELETE",
        body: JSON.stringify(eventId),
    });
};

/**
 * Fetch one event's change log ("היסטוריית שינויים"), newest first.
 * @param eventId Event whose log is requested.
 * @param iterationId Iteration to read from; defaults to the current run.
 */
export async function apiGetEventHistory(
    eventId: EventId,
    iterationId?: IterationId,
): Promise<ApiEventHistoryResponse> {
    const endpoint = withIteration(
        new URL("/api/event/history", window.location.origin),
        iterationId,
    );
    endpoint.searchParams.set("id", eventId);
    return await safeApiFetcher<ApiEventHistoryResponse>(endpoint.toString(), {
        method: "GET",
    });
}

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
        a: rawData.a.map(eventDateFixupToDayjs),
        b: rawData.b.map(eventDateFixupToDayjs),
    };
}
