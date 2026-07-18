import { DbEventDocument } from "@/api-server/db-event";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { Event } from "@/components/schedule/types/event";

export function eventDateFixup<T extends Partial<DbEventDocument | Event>>(
    event: T,
): T {
    // Create a shallow copy so we don't mutate React state or cached objects
    const result = { ...event };

    if (typeof window === "undefined") {
        // --- SERVER ENVIRONMENT (Target: Native Date) ---
        if (result.startTime !== undefined) {
            result.startTime = new Date(
                result.startTime as string | number | Date,
            ) as T["startTime"];
        }
        if (result.endTime !== undefined) {
            result.endTime = new Date(
                result.endTime as string | number | Date,
            ) as T["endTime"];
        }
    } else {
        // --- CLIENT ENVIRONMENT (Target: Dayjs) ---
        // Anchor to the app timezone so the wall-clock is DST-correct and
        // independent of the viewer's browser timezone (#168).
        if (result.startTime !== undefined) {
            result.startTime = dayjs(
                result.startTime as string | number | Date,
            ).tz(APP_TIMEZONE) as T["startTime"];
        }
        if (result.endTime !== undefined) {
            result.endTime = dayjs(
                result.endTime as string | number | Date,
            ).tz(APP_TIMEZONE) as T["endTime"];
        }
    }

    return result;
}
