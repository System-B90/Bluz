import { safeApiFetcher } from "@/api-client/common";
import { eventDateFixup } from "@/api-shared/calendar";
import { Event } from "@/components/schedule/types/event";

export async function apiGetEvents({ startDate, endDate }: { startDate?: Date; endDate?: Date; }): Promise<Array<Event>>
{
    console.log(`startDate: ${startDate}, endDate: ${endDate}`);
    // return [
    //     {
    //         id: '1',
    //         name: 'ע"ע ד\'',
    //         subject: 1,
    //         startTime: dayjs(),
    //         endTime: dayjs().add(1, 'hour'),
    //         type: 'exercise',
    //         room: 1,
    //         instructors: [ 3, 4 ],
    //         tags: [ 1, 2 ],
    //         notes: '',
    //         locked: false,
    //         required: false,
    //         hidden: false,
    //     },
    //     {
    //         id: '2',
    //         name: 'ס\'',
    //         subject: 2,
    //         startTime: dayjs().add(3, 'hours'),
    //         endTime: dayjs().add(4.5, 'hours'),
    //         type: 'lecture',
    //         room: 2,
    //         instructors: [ 5, 3 ],
    //         lecturer: 3,
    //         tags: [ 1, 2 ],
    //         notes: '',
    //         locked: false,
    //         required: false,
    //         hidden: false,
    //     },
    //     {
    //         id: '3',
    //         name: 'ג\'',
    //         subject: 3,
    //         startTime: dayjs().add(6, 'hours'),
    //         endTime: dayjs().add(6.5, 'hours'),
    //         type: 'lecture',
    //         room: 2,
    //         instructors: [ 4 ],
    //         lecturer: 'איש חוץ',
    //         tags: [ 1, 2 ],
    //         notes: '',
    //         locked: false,
    //         required: false,
    //         hidden: false,
    //     },
    // ];

    const endpoint = new URL('/api/event', window.location.origin);
    endpoint.searchParams.set('sd', startDate?.toISOString() ?? '');
    endpoint.searchParams.set('ed', endDate?.toISOString() ?? '');
    return (safeApiFetcher(endpoint.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }) as Promise<Array<Event>>).then((ps) => ps.map(eventDateFixup));
}

export async function apiSaveEvent(event: Event): Promise<Event>
{
    return safeApiFetcher('/api/event', {
        method: 'POST',
        body: JSON.stringify(event),
    }).then(eventDateFixup);
}

export async function apiDeleteEvent(eventId: Event[ 'id' ]): Promise<void>
{
    return safeApiFetcher('/api/event', {
        method: 'DELETE',
        body: JSON.stringify(eventId),
    });
}
