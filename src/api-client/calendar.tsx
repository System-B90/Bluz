import { safeApiFetcher } from "@/api-client/common";
import { dateFixup } from "@/api-shared/calendar";
import { Period } from "@/components/schedule/types/event";
import dayjs, { Dayjs } from "dayjs";

export async function apiGetPeriods({ startDate, endDate }: { startDate?: Date; endDate?: Date; }): Promise<Array<Period>>
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

    const endpoint = new URL('/api/period', window.location.origin);
    endpoint.searchParams.set('sd', startDate?.toISOString() ?? '');
    endpoint.searchParams.set('ed', endDate?.toISOString() ?? '');
    return (safeApiFetcher(endpoint.toString(), {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }) as Promise<Array<Period>>).then((ps) => ps.map(dateFixup));
}

export async function apiSavePeriod(period: Period): Promise<Period>
{
    return safeApiFetcher('/api/period', {
        method: 'POST',
        body: JSON.stringify(period),
    }).then(dateFixup);
}

export async function apiDeletePeriod(periodId: Period[ 'id' ]): Promise<void>
{
    return safeApiFetcher('/api/period', {
        method: 'DELETE',
        body: JSON.stringify(periodId),
    });
}
