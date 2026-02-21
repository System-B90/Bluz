import { DbPeriod } from "@/api-server/period";
import { inplaceDateFixup } from "@/api-shared/date-fixer";
import { PrayerSettings } from "@/api-shared/types/settings/prayer";
import { EventType, Period, PrayerEvent, PrayerType, prayerTypeToHebrew } from "@/components/schedule/types/event";

async function updatePrayerEvent({ prayerEvent, newConfig }: { prayerEvent: Period, newConfig: PrayerSettings; })
{
    const updatedEvent: Partial<PrayerEvent> = { ...prayerEvent } as PrayerEvent;
    switch (updatedEvent.prayerType)
    {
        case 'shacharit':
            updatedEvent.startTime = newConfig.shacharit;
            updatedEvent.endTime = new Date((newConfig.shacharit as Date).getTime() + 20 * 60 * 1000); // Add 20min
            break;
        case 'mincha':
            updatedEvent.startTime = newConfig.mincha;
            updatedEvent.endTime = new Date((newConfig.mincha as Date).getTime() + 20 * 60 * 1000); // Add 20min
            break;
        case 'arvit':
            updatedEvent.startTime = newConfig.arvit;
            updatedEvent.endTime = new Date((newConfig.arvit as Date).getTime() + 20 * 60 * 1000); // Add 20min
            break;
    }

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
            await DbPeriod.set(prayer);
        }
    }
    await Promise.all(prayerEvents.map(async (prayerEvent) => await updatePrayerEvent({ prayerEvent, newConfig })));
}

export async function updatePrayerEvents({ startDate, newConfig }: { startDate: Date, newConfig: PrayerSettings; })
{
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++)
    {
        const day = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        await updatePrayerEventsInDay({ day, newConfig });
    }
}
