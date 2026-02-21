import { Dayjs } from "dayjs";

export enum EventType
{
    EXERCISE = 'exercise',
    LECTURE = 'lecture',
    BREAK = 'break',
    PRAYER = 'prayer',
    OTHER = 'other',
}
export function eventHasSubject(type: EventType): boolean
{
    return type === EventType.EXERCISE || type === EventType.LECTURE;
}
export function eventHasRoom(type: EventType): boolean
{
    return type !== EventType.PRAYER;
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

export enum PrayerType
{
    SHACHARIT = 'shacharit',
    MINCHA = 'mincha',
    ARVIT = 'arvit',
}

export function prayerTypeToHebrew(prayerType: PrayerType): string
{
    const LOOKUP: Record<PrayerType, string> = {
        'shacharit': 'שחרית',
        'mincha': 'מנחה',
        'arvit': 'ערבית',
    };
    return LOOKUP[ prayerType ] ?? prayerType;
}

export interface PrayerEvent extends Period
{
    type: EventType.PRAYER;
    prayerType: PrayerType;
}


export function periodTypeToHebrew(type: Period[ 'type' ]): string
{
    const LOOKUP: Record<Period[ 'type' ], string> = {
        'exercise': 'ע"ע',
        'lecture': 'הרצאה',
        'other': 'אחר',
        'break': 'הפסקה',
        'prayer': 'תפילה',
    };
    return LOOKUP[ type ] ?? type;
}

export function getPresentInstructors(period: Period): Array<number>;
export function getPresentInstructors(period: Period, includeOutsiders: boolean = false): Array<PersonId>
{
    const reduced = new Set<PersonId>([ ...period.instructors, ...period.lecturers?.filter((v) => (typeof v === 'number' || includeOutsiders)) ?? [] ]);
    return Array.from(reduced);
}
