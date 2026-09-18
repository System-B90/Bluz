import {
    calendarWantsEvent,
    GoogleSyncSubscriber,
} from "@/api-server/google/google-calendar-scope";
import {
    listGoogleCalendarLinks,
    pullEventEdits,
    pushEventToGoogle,
} from "@/api-server/google/google-calendar-service";
import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbEventDocument } from "@/api-shared/types/event";
import { GoogleCalendarLink } from "@/api-shared/types/google-calendar";
import { IterationId } from "@/api-shared/types/iteration";
import { logger } from "@/logging/pino";

/** One Google calendar and the opted-in users whose links point at it. */
type CalendarGroup = {
    calendarId: string;
    links: Array<GoogleCalendarLink>;
    subscribers: Array<GoogleSyncSubscriber>;
};

/**
 * Opted-in users grouped by the calendar they mirror into. Several users may
 * share one calendar (its owner shared it with them), so the fan-out must
 * run per calendar, not per user — otherwise every event is written N times
 * to the same place, and one user's disconnect cannot be covered by another.
 * Links bound to a different iteration than the event's are left out: a
 * calendar mirrors exactly one iteration.
 */
async function groupLinksByCalendar(
    iterationId?: IterationId,
): Promise<Array<CalendarGroup>> {
    const settingsDocs = await getMetaController()
        .personalSettings.find({ googleCalendarEnabled: true })
        .toArray();
    if (!settingsDocs.length) return [];

    const syncAllByUser = new Map(
        settingsDocs.map((d) => [d.userId, Boolean(d.googleCalendarSyncAllEvents)]),
    );
    const links = await listGoogleCalendarLinks([...syncAllByUser.keys()]);

    const groups = new Map<string, CalendarGroup>();
    for (const link of links) {
        if (iterationId && link.iterationId && link.iterationId !== iterationId) {
            continue;
        }
        const group = groups.get(link.calendarId) ?? {
            calendarId: link.calendarId,
            links: [],
            subscribers: [],
        };
        group.links.push(link);
        group.subscribers.push({
            userId: link.userId,
            syncAllEvents: syncAllByUser.get(link.userId) ?? false,
        });
        groups.set(link.calendarId, group);
    }
    return [...groups.values()];
}

/**
 * Pushes through the first link whose credentials work. A user who revoked
 * Bluz's access in their Google account must not blind the whole shared
 * calendar while a colleague's link is still good.
 */
async function pushViaAnyLink(
    group: CalendarGroup,
    event: DbEventDocument,
    action: "delete" | "upsert",
    iterationId?: IterationId,
): Promise<boolean> {
    for (const link of group.links) {
        if (await pushEventToGoogle(link.userId, event, action, iterationId)) {
            return true;
        }
    }
    return false;
}

/**
 * Fire-and-forget: mirrors the given event into every linked Google calendar
 * that wants it — one write per calendar, however many users share it. A
 * calendar wants the event when any of its users is an assigned instructor
 * or lecturer, or opted into syncing every event. When `previous` is given
 * (an update), calendars that wanted the old version but not the new one
 * (say, the instructor was swapped) get a delete, so nothing is orphaned.
 * Never throws — a Google outage or missing configuration must never affect
 * the Bluz event write it's attached to.
 */
export function syncEventToInstructorsGoogleCalendars(
    event: DbEventDocument,
    action: "delete" | "upsert",
    // Tagged onto the Google copy so a pulled-back edit lands in the right
    // iteration's database (#538 item 6), and matched against each link's
    // bound iteration.
    iterationId?: IterationId,
    previous?: DbEventDocument,
): void {
    void (async () => {
        try {
            const groups = await groupLinksByCalendar(iterationId);
            await Promise.all(
                groups.map(async (group) => {
                    const wantsNow =
                        action === "upsert" &&
                        calendarWantsEvent(event, group.subscribers);
                    const wantedBefore =
                        previous !== undefined &&
                        calendarWantsEvent(previous, group.subscribers);

                    if (wantsNow) {
                        await pushViaAnyLink(group, event, "upsert", iterationId);
                    } else if (action === "delete" || wantedBefore) {
                        await pushViaAnyLink(group, event, "delete", iterationId);
                    }
                }),
            );
        } catch (error) {
            logger.warn({ err: error }, "Google Calendar sync skipped:");
        }
    })();
}

const PULL_THROTTLE_MS = 5 * 60 * 1000;
const lastPullByUser = new Map<string, number>();

/**
 * Fire-and-forget, throttled (per user, 5 min): pulls Google-side edits of
 * Bluz-pushed events back into Bluz. Hung off calendar reads so Google edits
 * flow in while users browse, without polling infrastructure. Updates land
 * via DbEvent.set, which broadcasts over WebSocket to open clients.
 */
export function pullGoogleEditsInBackground(userId: string): void {
    const last = lastPullByUser.get(userId) ?? 0;
    if (Date.now() - last < PULL_THROTTLE_MS) return;
    lastPullByUser.set(userId, Date.now());
    void pullEventEdits(userId).catch((error) =>
        logger.warn({ err: error }, "Google Calendar background pull failed:"),
    );
}
