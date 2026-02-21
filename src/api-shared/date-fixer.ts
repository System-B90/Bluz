import dayjs, { Dayjs } from 'dayjs';

export function inplaceDateFixup<T>(item: T, fieldName: keyof T)
{
    const value = item[ fieldName ];
    if (!value) { return; };

    if (typeof window === 'undefined')
    {
        // SERVER SIDE: Prepare for MongoDB/API
        // Convert to native Date object or ISO string
        item[ fieldName ] = new Date(value as any) as any;
    } else
    {
        // CLIENT SIDE: Prepare for UI
        // Convert to Dayjs object for easy manipulation
        item[ fieldName ] = dayjs(value as any) as any;
    }
}
