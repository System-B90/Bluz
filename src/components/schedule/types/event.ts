import { Dayjs } from "dayjs";

export type EventType = 'exercise' | 'lecture' | 'other' | 'break';

export interface Period
{
    id: number;
    name: string;
    subject: number; // Subject ID
    startTime: Dayjs;
    endTime: Dayjs;
    type: EventType;
    room: number; // Room ID
    instructors: number[]; // Array of instructor IDs
    lecturer?: 'איש חוץ' | number; // Main lecturer ID
    tags: number[];
    notes: string;
    locked: boolean; // New field to indicate if period is locked
    hidden: boolean;
    required: boolean; // New field for potential F.A. (פוטנציאל פ"א)
}