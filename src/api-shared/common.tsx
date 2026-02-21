import dayjs from "dayjs";

export interface ApiResponseJson
{
    status: number;
    data?: any;
    error?: any;
}

export type Keys<T> = keyof T;
export function getKeysOfObject<T extends object>(obj: T): Keys<T>[]
{
    return Object.keys(obj) as Keys<T>[];
}
