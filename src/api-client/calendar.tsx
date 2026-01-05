import { safeApiFetcher } from "@/api-client/common";
import { Period } from "@/components/schedule/types/event";
import dayjs from "dayjs";

export async function apiGetPeriods(): Promise<Array<Period>>
{
    return [
        {
            id: '1',
            name: 'ע"ע ד\'',
            subject: 'ד',
            startTime: dayjs(),
            endTime: dayjs().add(1, 'hour'),
            type: 'exercise',
            room: '3',
            instructors: [ 'Instructor 1', 'Instructor 2' ],
            tags: [ 'Tag 1', 'Tag 2' ],
            notes: '',
            locked: false,
            required: false,
            hidden: false,
        },
        {
            id: '2',
            name: 'ס\'',
            subject: 'ס',
            startTime: dayjs().add(3, 'hours'),
            endTime: dayjs().add(4.5, 'hours'),
            type: 'lecture',
            room: '5',
            instructors: [ 'Instructor 1', 'Instructor 2' ],
            tags: [ 'Tag 1', 'Tag 2' ],
            notes: '',
            locked: false,
            required: false,
            hidden: false,
        },
    ];
    return safeApiFetcher('/api/calendar/periods', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }) as Promise<Array<Period>>;
}