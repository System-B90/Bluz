import { pushEventToGoogle } from "@/api-server/google/google-calendar-service";
import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbEventDocument, getPresentInstructors } from "@/api-shared/types/event";

/**
 * Fire-and-forget: pushes the given event to the Google Calendar of every
 * assigned instructor who opted into sync. Never throws — a Google outage or
 * missing configuration must never affect the Bluz event write it's attached to.
 */
export function syncEventToInstructorsGoogleCalendars(
    event: DbEventDocument,
    action: "delete" | "upsert",
): void {
    void (async () => {
        try {
            const instructorIds = getPresentInstructors(event as any).filter(
                (id): id is number => typeof id === "number",
            );
            if (instructorIds.length === 0) return;

            const userIds = instructorIds.map(String);
            const settingsDocs = await getMetaController()
                .personalSettings.find({
                    userId: { $in: userIds },
                    googleCalendarEnabled: true,
                })
                .toArray();

            await Promise.all(
                settingsDocs.map((doc) =>
                    pushEventToGoogle(doc.userId, event, action),
                ),
            );
        } catch (error) {
            console.warn("Google Calendar sync skipped:", error);
        }
    })();
}
