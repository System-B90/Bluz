import { DbEventDocument, getPresentInstructors } from "@/api-shared/types/event";

/**
 * Pure sync-scope rules shared by the push fan-out and the orphan purge, so
 * "should this calendar hold this event?" has exactly one answer. No I/O.
 */

/** The bit of a user's personal settings the scope decision needs. */
export type GoogleSyncSubscriber = {
    userId: string;
    /** `googleCalendarSyncAllEvents`: every event, regardless of assignment. */
    syncAllEvents: boolean;
};

/** Bluz user ids (as strings) assigned to the event as instructor/lecturer. */
export function eventUserIds(
    event: Pick<DbEventDocument, "instructors" | "lecturers">,
): Set<string> {
    return new Set(
        getPresentInstructors(event)
            .filter((id): id is number => typeof id === "number")
            .map(String),
    );
}

/**
 * A calendar holds an event when at least one of the users mirroring into it
 * either syncs everything or is assigned to the event.
 */
export function calendarWantsEvent(
    event: Pick<DbEventDocument, "instructors" | "lecturers">,
    subscribers: Array<GoogleSyncSubscriber>,
): boolean {
    const assigned = eventUserIds(event);
    return subscribers.some(
        (s) => s.syncAllEvents || assigned.has(s.userId),
    );
}
