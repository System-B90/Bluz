import dayjs from "dayjs";

import { DbEventDocument } from "@/api-server/db-event";
import { Event } from "@/components/schedule/types/event";

export function eventDateFixup<T extends Partial<DbEventDocument | Event>>(
    event: T,
): T {
    // Create a shallow copy so we don't mutate React state or cached objects
    const result = { ...event };

    if (typeof window === "undefined") {
        // --- SERVER ENVIRONMENT (Target: Native Date) ---
        if (result.startTime !== undefined) {
            result.startTime = new Date(result.startTime as any) as any;
        }
        if (result.endTime !== undefined) {
            result.endTime = new Date(result.endTime as any) as any;
        }
    } else {
        // --- CLIENT ENVIRONMENT (Target: Dayjs) ---
        if (result.startTime !== undefined) {
            result.startTime = dayjs(result.startTime) as any;
        }
        if (result.endTime !== undefined) {
            result.endTime = dayjs(result.endTime) as any;
        }
    }

    return result;
}
