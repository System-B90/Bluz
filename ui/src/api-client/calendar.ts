import { safeApiFetcher } from "@/api-client/common";
import { eventDateFixup } from "@/api-shared/calendar";
import { Event, EventId } from "@/api-shared/types/event";

export async function apiGetEvents({
    startDate,
    endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}): Promise<Array<Event>> {
    const endpoint = new URL("/api/event", window.location.origin);
    endpoint.searchParams.set("sd", startDate?.toISOString() ?? "");
    endpoint.searchParams.set("ed", endDate?.toISOString() ?? "");
    return await safeApiFetcher<Array<Event>>(endpoint.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then((ps) => ps.map(eventDateFixup));
}

export async function apiGetMultipleEvents(
    eventIds: Array<EventId>,
): Promise<Record<EventId, Event>> {
    const endpoint = new URL("/api/event", window.location.origin);
    endpoint.searchParams.set("ids", eventIds.join(","));
    const rawData = await safeApiFetcher<Record<EventId, Event>>(
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
    return rawData;
}

export async function apiCreateEvent(event: Event): Promise<Event> {
    return await safeApiFetcher<Event>("/api/event", {
        method: "PUT",
        body: JSON.stringify(event),
    }).then(eventDateFixup);
}

export async function apiUpdateEvent(event: Event): Promise<Event> {
    return await safeApiFetcher<Event>("/api/event", {
        method: "POST",
        body: JSON.stringify(event),
    }).then(eventDateFixup);
}

export async function apiDeleteEvent(eventId: EventId): Promise<void> {
    return await safeApiFetcher<void>("/api/event", {
        method: "DELETE",
        body: JSON.stringify(eventId),
    });
}
