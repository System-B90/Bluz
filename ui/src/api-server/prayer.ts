import { Dayjs } from "dayjs";

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { EventDataUpdateMessage } from "@/api-shared/types";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    Event,
    EventType,
    PrayerEvent,
    PrayerType,
    prayerTypeToHebrew,
} from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";

/**
 * The configured clock time for one prayer, as a Date.
 *
 * Prayer times reach the server as whatever JSON carried them — an ISO string
 * — not as the `Date | Dayjs` the settings type promises, so reading
 * `.getHours()` off the raw value throws. Normalize once, here.
 */
function prayerTimeOf(
    config: PrayerSettings,
    prayerType: keyof PrayerSettings,
): Date {
    const value = config[prayerType] as Date | Dayjs | number | string;
    const parsed =
        value instanceof Date
            ? value
            : typeof value === "object" && value !== null && "toDate" in value
                ? value.toDate()
                : new Date(value);
    if (isNaN(parsed.getTime())) {
        throw new ClientApiError(`שעת תפילה לא תקינה עבור ${prayerType}`);
    }
    return parsed;
}

async function updatePrayerEvent({
    day,
    prayerEvent,
    newConfig,
}: {
    day: Date;
    prayerEvent: Event;
    newConfig: PrayerSettings;
}): Promise<PrayerEvent> {
    const updatedEvent: PrayerEvent = { ...prayerEvent } as PrayerEvent;

    const prayerTime = prayerTimeOf(
        newConfig,
        updatedEvent.prayerType as keyof PrayerSettings,
    );
    const startTime = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        prayerTime.getHours(),
        prayerTime.getMinutes(),
        prayerTime.getSeconds(),
    );
    const endTime = new Date(startTime.getTime() + 20 * 60 * 1000); // Add 20min

    (updatedEvent.startTime as unknown as Date) = startTime;
    (updatedEvent.endTime as unknown as Date) = endTime;

    await DbEvent.set(
        updatedEvent as unknown as DbEventDocument,
        undefined,
        undefined,
        undefined,
        { initiator: EventChangeInitiator.PrayerSettings },
    );
    return updatedEvent;
}

async function updatePrayerEventsInDay({
    day,
    newConfig,
}: {
    day: Date;
    newConfig: PrayerSettings;
}) {
    // Clone day to avoid mutating caller's date
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const existingPrayerEvents: Array<PrayerEvent> =
        (await DbEvent.getInRange(
            dayStart,
            endOfDay,
            undefined,
            { type: EventType.PRAYER } as any,
        )) as unknown as Array<PrayerEvent>;

    if (existingPrayerEvents.length > 3) {
        throw new Error("Too many prayer events in a day");
    }

    let broadcastEvents: Array<PrayerEvent>;

    if (existingPrayerEvents.length === 0) {
        // First-time creation — create all prayer types and broadcast the created events
        const prayersToCreate: Array<PrayerEvent> = Object.values(
            PrayerType,
        ).map((prayerType) => {
            const prayerTime = prayerTimeOf(
                newConfig,
                prayerType as keyof PrayerSettings,
            );
            const startTime = new Date(
                dayStart.getFullYear(),
                dayStart.getMonth(),
                dayStart.getDate(),
                prayerTime.getHours(),
                prayerTime.getMinutes(),
                prayerTime.getSeconds(),
            );

            return {
                id: crypto.randomUUID(),
                name: prayerTypeToHebrew(prayerType),
                type: EventType.PRAYER,
                startTime,
                endTime: new Date(startTime.getTime() + 20 * 60 * 1000),
                prayerType: prayerType as PrayerEvent["prayerType"],
                subject: 0,
                hiveModule: 0,
                courses: [],
                rooms: [],
                instructors: [],
                lecturers: [],
                tags: [],
                notes: "",
                locked: true,
                required: false,
                hidden: false,
                personalTalk: false,
            } as unknown as PrayerEvent;
        });

        for (const prayer of prayersToCreate) {
            prayer.id = (
                await DbEvent.create(
                    prayer as unknown as DbEventDocument,
                    undefined,
                    undefined,
                    undefined,
                    { initiator: EventChangeInitiator.PrayerSettings },
                )
            ).id;
        }
        broadcastEvents = prayersToCreate;
    } else {
        // Update existing prayer events and broadcast the updated versions
        broadcastEvents = await Promise.all(
            existingPrayerEvents.map((prayerEvent) =>
                updatePrayerEvent({ day: dayStart, prayerEvent, newConfig }),
            ),
        );
    }

    SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
        events: broadcastEvents.reduce(
            (acc, event) => ({ ...acc, [event.id]: event }),
            {},
        ),
    } as EventDataUpdateMessage<DbEventDocument>);
}

export async function updatePrayerEvents({
    startDate,
    newConfig,
}: {
    startDate: Date;
    newConfig: PrayerSettings;
}) {
    // Clone to avoid mutating the caller's Date
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    await Promise.all(
        Array.from({ length: 7 }, async (_, i) => {
            const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
            await updatePrayerEventsInDay({ day, newConfig });
        }),
    );
}
