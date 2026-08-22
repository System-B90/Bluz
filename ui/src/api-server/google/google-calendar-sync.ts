import {
    pullEventEdits,
    pushEventToGoogle,
} from "@/api-server/google/google-calendar-service";
import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbEventDocument, getPresentInstructors } from "@/api-shared/types/event";
import { IterationId } from "@/api-shared/types/iteration";

/**
 * Fire-and-forget: pushes the given event to the Google Calendar of every
 * assigned instructor who opted into sync, plus any user who opted into
 * syncing every event regardless of assignment. Never throws — a Google
 * outage or missing configuration must never affect the Bluz event write
 * it's attached to.
 */
export function syncEventToInstructorsGoogleCalendars(
    event: DbEventDocument,
    action: "delete" | "upsert",
    // Tagged onto the Google copy so a pulled-back edit lands in the right
    // iteration's database (#538 item 6).
    iterationId?: IterationId,
): void {
    void (async () => {
        try {
            const instructorIds = new Set(
                getPresentInstructors(event)
                    .filter((id): id is number => typeof id === "number")
                    .map(String),
            );

            const settingsDocs = await getMetaController()
                .personalSettings.find({
                    googleCalendarEnabled: true,
                    $or: [
                        { userId: { $in: [...instructorIds] } },
                        { googleCalendarSyncAllEvents: true },
                    ],
                })
                .toArray();

            await Promise.all(
                settingsDocs.map((doc) =>
                    pushEventToGoogle(doc.userId, event, action, iterationId),
                ),
            );
        } catch (error) {
            console.warn("Google Calendar sync skipped:", error);
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
        console.warn("Google Calendar background pull failed:", error),
    );
}
