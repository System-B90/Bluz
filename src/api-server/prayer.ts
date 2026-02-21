import { DbPeriod } from "@/api-server/period";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { PeriodDataUpdateMessage } from "@/api-shared/types";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import { EventType, Period, PrayerEvent, PrayerType, prayerTypeToHebrew } from "@/components/schedule/types/event";
import { MessageTypes } from "@/settings";

async function updatePrayerEvent({ day, prayerEvent, newConfig }: { day: Date, prayerEvent: Period, newConfig: PrayerSettings; })
{
    const updatedEvent: PrayerEvent = { ...prayerEvent } as PrayerEvent;

    const startTime = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        (newConfig[ updatedEvent.prayerType ] as Date).getHours(),
        (newConfig[ updatedEvent.prayerType ] as Date).getMinutes(),
        (newConfig[ updatedEvent.prayerType ] as Date).getSeconds()
    );
    const endTime = new Date(startTime.getTime() + 20 * 60 * 1000); // Add 20min

    updatedEvent.startTime = startTime;
    updatedEvent.endTime = endTime;

    await DbPeriod.set(updatedEvent);
}

async function updatePrayerEventsInDay({ day, newConfig }: { day: Date, newConfig: PrayerSettings; })
{
    const endOfDay = new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
    const prayerEvents: Array<PrayerEvent> = await DbPeriod.getInRange(day, endOfDay, undefined, { type: EventType.PRAYER } as any) as unknown as Array<PrayerEvent>;

    if (prayerEvents.length > 3)
    {
        throw new Error("Too many prayer events in a day");
    }
    else if (prayerEvents.length === 0)
    {
        // No prayer events in this day, create them
        const prayersToCreate: Array<PrayerEvent> = Object.values(PrayerType).map((prayerType) =>
        {
            const startTime = new Date(
                day.getFullYear(),
                day.getMonth(),
                day.getDate(),
                (newConfig[ prayerType as keyof PrayerSettings ] as Date).getHours(),
                (newConfig[ prayerType as keyof PrayerSettings ] as Date).getMinutes(),
                (newConfig[ prayerType as keyof PrayerSettings ] as Date).getSeconds()
            );

            return {
                id: undefined,
                name: prayerTypeToHebrew(prayerType),
                type: EventType.PRAYER,
                startTime,
                endTime: new Date(startTime.getTime() + 20 * 60 * 1000), // Add 20min
                prayerType: prayerType as PrayerEvent[ 'prayerType' ],
                subject: 0,
                hiveModule: 0,
                rooms: [],
                instructors: [],
                lecturers: [],
                tags: [],
                notes: '',
                locked: true,
                required: false,
                hidden: false,
                personalTalk: false,
            } as unknown as PrayerEvent;
        });

        for (const prayer of prayersToCreate)
        {
            prayer.id = (await DbPeriod.set(prayer)).id;
        }
    }
    await Promise.all(prayerEvents.map(async (prayerEvent) => await updatePrayerEvent({ day, prayerEvent, newConfig })));
    SendServerRequestToSessionServer(MessageTypes.PERIOD_DATA_UPDATE, { periods: prayerEvents.reduce((acc, event) => ({ ...acc, [ event.id ]: event }), {}) } as PeriodDataUpdateMessage);
}

export async function updatePrayerEvents({ startDate, newConfig }: { startDate: Date, newConfig: PrayerSettings; })
{
    startDate.setHours(0, 0, 0, 0);
    Promise.all(Array.from({ length: 7 }, async (_, i) =>
    {
        const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        await updatePrayerEventsInDay({ day, newConfig });
    },));
}
