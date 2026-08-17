import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { DbEventDocument, Event } from "@/api-shared/types/event";

export function eventDateFixup<T extends Partial<DbEventDocument | Event>>(
    event: T,
): T {
    // Create a shallow copy so we don't mutate React state or cached objects
    const result = { ...event };

    if (typeof window === "undefined") {
        // --- SERVER ENVIRONMENT (Target: Native Date) ---
        if (result.startTime !== undefined) {
            result.startTime = new Date(
                result.startTime as Date | number | string,
            ) as T["startTime"];
        }
        if (result.endTime !== undefined) {
            result.endTime = new Date(
                result.endTime as Date | number | string,
            ) as T["endTime"];
        }
    } else {
        // --- CLIENT ENVIRONMENT (Target: Dayjs) ---
        // Anchor to the app timezone so the wall-clock is DST-correct and
        // independent of the viewer's browser timezone (#168).
        if (result.startTime !== undefined) {
            result.startTime = dayjs(
                result.startTime as Date | number | string,
            ).tz(APP_TIMEZONE) as T["startTime"];
        }
        if (result.endTime !== undefined) {
            result.endTime = dayjs(
                result.endTime as Date | number | string,
            ).tz(APP_TIMEZONE) as T["endTime"];
        }
    }

    return result;
}
