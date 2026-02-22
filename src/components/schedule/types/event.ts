import { CourseId } from "@/api-shared/types/course";
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

export interface Event
{
    id: string;
    name: string;
    subject: number; // Subject ID
    hiveModule: number; // Module ID
    startTime: Dayjs | Date;
    endTime: Dayjs | Date;
    type: EventType;
    courses: Array<CourseId>;
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

export interface PrayerEvent extends Event
{
    type: EventType.PRAYER;
    prayerType: PrayerType;
}


export function eventTypeToHebrew(type: Event[ 'type' ]): string
{
    const LOOKUP: Record<Event[ 'type' ], string> = {
        'exercise': 'ע"ע',
        'lecture': 'הרצאה',
        'other': 'אחר',
        'break': 'הפסקה',
        'prayer': 'תפילה',
    };
    return LOOKUP[ type ] ?? type;
}

export function getPresentInstructors(event: Event): Array<number>;
export function getPresentInstructors(event: Event, includeOutsiders: boolean = false): Array<PersonId>
{
    const reduced = new Set<PersonId>([ ...event.instructors, ...event.lecturers?.filter((v) => (typeof v === 'number' || includeOutsiders)) ?? [] ]);
    return Array.from(reduced);
}
