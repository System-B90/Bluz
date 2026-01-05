import { Dayjs } from "dayjs";

export type EventType = 'exercise' | 'lecture' | 'other' | 'break';

export interface Period
{
    id: string;
    name: string;
    subject: number; // Subject ID
    startTime: Dayjs | Date;
    endTime: Dayjs | Date;
    type: EventType;
    rooms: Array<number>; // Room IDs
    instructors: number[]; // Array of instructor IDs
    lecturer?: 'איש חוץ' | number; // Main lecturer ID
    tags: number[];
    notes: string;
    locked: boolean;
    hidden: boolean;
    required: boolean;
    personalTalk: boolean;
}
