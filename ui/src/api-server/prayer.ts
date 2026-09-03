import { Dayjs } from "dayjs";

import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { ClientApiError } from "@/api-shared/errors";
import { EventDataUpdateMessage } from "@/api-shared/types";
import {
    Event,
    EventType,
    PrayerEvent,
    PrayerType,
    prayerTypeToHebrew,
} from "@/api-shared/types/event";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import { CURRENT_ITERATION_SYNC_ID, MessageTypes } from "@/settings";

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
    // Venue-local wall-clock placement, same as the creation path (#538 item 5).
    const startTime = dayjs(day)
        .tz(APP_TIMEZONE)
        .startOf("day")
        .hour(prayerTime.getHours())
        .minute(prayerTime.getMinutes())
        .second(prayerTime.getSeconds())
        .millisecond(0)
        .toDate();
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
    // Day boundaries are venue-local, not server-local, and a DST day is not
    // 24h long — a fixed millisecond span silently shifted the window across
    // the spring/autumn transitions (#538 item 5).
    const venueDay = dayjs(day).tz(APP_TIMEZONE).startOf("day");
    const dayStart = venueDay.toDate();
    const endOfDay = venueDay.endOf("day").toDate();

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
            // The configured prayer time is a venue-local wall-clock time, so
            // it has to be placed on the venue's day, not the server's.
            const startTime = venueDay
                .hour(prayerTime.getHours())
                .minute(prayerTime.getMinutes())
                .second(prayerTime.getSeconds())
                .millisecond(0)
                .toDate();

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

    SendServerRequestToSessionServer(
        MessageTypes.EVENT_DATA_UPDATE,
        {
            events: broadcastEvents.reduce(
                (acc, event) => ({ ...acc, [event.id]: event }),
                {},
            ),
        } as EventDataUpdateMessage<DbEventDocument>,
        // Prayer events only ever apply to the current run — there is no
        // iterationId field on this payload.
        CURRENT_ITERATION_SYNC_ID,
    );
}

export async function updatePrayerEvents({
    startDate,
    newConfig,
}: {
    startDate: Date;
    newConfig: PrayerSettings;
}) {
    // Step in venue-local calendar days: adding 24h at a time lands on the
    // wrong day either side of a DST transition (#538 item 5).
    const start = dayjs(startDate).tz(APP_TIMEZONE).startOf("day");

    await Promise.all(
        Array.from({ length: 7 }, async (_, i) => {
            await updatePrayerEventsInDay({
                day: start.add(i, "day").toDate(),
                newConfig,
            });
        }),
    );
}
