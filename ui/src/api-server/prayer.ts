import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { EventDataUpdateMessage } from "@/api-shared/types";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import {
    Event,
    EventType,
    PrayerEvent,
    PrayerType,
    prayerTypeToHebrew,
} from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";

async function updatePrayerEvent({
    day,
    prayerEvent,
    newConfig,
}: {
  day: Date;
  prayerEvent: Event;
  newConfig: PrayerSettings;
}) {
    const updatedEvent: PrayerEvent = { ...prayerEvent } as PrayerEvent;

    const startTime = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        (newConfig[updatedEvent.prayerType] as Date).getHours(),
        (newConfig[updatedEvent.prayerType] as Date).getMinutes(),
        (newConfig[updatedEvent.prayerType] as Date).getSeconds(),
    );
    const endTime = new Date(startTime.getTime() + 20 * 60 * 1000); // Add 20min

    (updatedEvent.startTime as unknown as Date) = startTime;
    (updatedEvent.endTime as unknown as Date) = endTime;

    await DbEvent.set(updatedEvent as unknown as DbEventDocument);
}

async function updatePrayerEventsInDay({
    day,
    newConfig,
}: {
  day: Date;
  newConfig: PrayerSettings;
}) {
    const endOfDay = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
    const prayerEvents: Array<PrayerEvent> = (await DbEvent.getInRange(
        day,
        endOfDay,
        undefined,
    { type: EventType.PRAYER } as any,
    )) as unknown as Array<PrayerEvent>;

    if (prayerEvents.length > 3) {
        throw new Error("Too many prayer events in a day");
    } else if (prayerEvents.length === 0) {
    // No prayer events in this day, create them
        const prayersToCreate: Array<PrayerEvent> = Object.values(PrayerType).map(
            (prayerType) => {
                const startTime = new Date(
                    day.getFullYear(),
                    day.getMonth(),
                    day.getDate(),
                    (newConfig[prayerType as keyof PrayerSettings] as Date).getHours(),
                    (newConfig[prayerType as keyof PrayerSettings] as Date).getMinutes(),
                    (newConfig[prayerType as keyof PrayerSettings] as Date).getSeconds(),
                );

                return {
                    id: crypto.randomUUID(),
                    name: prayerTypeToHebrew(prayerType),
                    type: EventType.PRAYER,
                    startTime,
                    endTime: new Date(startTime.getTime() + 20 * 60 * 1000), // Add 20min
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
            },
        );

        for (const prayer of prayersToCreate) {
            prayer.id = (
                await DbEvent.create(prayer as unknown as DbEventDocument)
            ).id;
        }
    }
    await Promise.all(
        prayerEvents.map(
            async (prayerEvent) =>
                await updatePrayerEvent({ day, prayerEvent, newConfig }),
        ),
    );
    SendServerRequestToSessionServer(MessageTypes.EVENT_DATA_UPDATE, {
        events: prayerEvents.reduce(
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
    startDate.setHours(0, 0, 0, 0);
    await Promise.all(
        Array.from({ length: 7 }, async (_, i) => {
            const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            await updatePrayerEventsInDay({ day, newConfig });
        }),
    );
}
