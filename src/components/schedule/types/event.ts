import { Dayjs } from "dayjs";

export enum EventType
{
    EXERCISE = 'exercise',
    LECTURE = 'lecture',
    OTHER = 'other',
    BREAK = 'break'
}

export interface Period
{
    id: string;
    name: string;
    subject: number; // Subject ID
    hiveModule: number; // Module ID
    startTime: Dayjs | Date;
    endTime: Dayjs | Date;
    type: EventType;
    rooms: Array<number>; // Room IDs
    instructors: number[]; // Array of instructor IDs
    lecturers?: Array<'איש חוץ' | number>;
    tags: number[];
    notes: string;
    locked: boolean;
    hidden: boolean;
    required: boolean;
    personalTalk: boolean;
}
