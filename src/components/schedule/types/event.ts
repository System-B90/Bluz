import { Dayjs } from "dayjs";

export enum EventType
{
    EXERCISE = 'exercise',
    LECTURE = 'lecture',
    OTHER = 'other',
    BREAK = 'break'
}

export type PersonId = number | 'איש חוץ';

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
    lecturers?: Array<PersonId>;
    tags: number[];
    notes: string;
    locked: boolean;
    hidden: boolean;
    required: boolean;
    personalTalk: boolean;
}



export function periodTypeToHebrew(type: Period[ 'type' ]): string
{
    const LOOKUP: Record<Period[ 'type' ], string> = {
        'exercise': 'ע"ע',
        'lecture': 'הרצאה',
        'other': 'אחר',
        'break': 'הפסקה',
    };
    return LOOKUP[ type ] ?? type;
}

export function getPresentInstructors(period: Period): Array<number>;
export function getPresentInstructors(period: Period, includeOutsiders: boolean = false): Array<PersonId>
{
    const reduced = new Set<PersonId>([ ...period.instructors, ...period.lecturers?.filter((v) => (typeof v === 'number' || includeOutsiders)) ?? [] ]);
    return Array.from(reduced);
}
