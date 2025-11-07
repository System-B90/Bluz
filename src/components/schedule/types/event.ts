import {Dayjs} from "dayjs";

export type EventType = 'exercise' | 'lecture' | 'other' | 'break';

export interface Period {
    id: string;
    name: string;
    subject: string; // Subject ID
    startTime: Dayjs;
    endTime: Dayjs;
    type: EventType;
    location: string;
    instructors: string[]; // Array of instructor IDs
    notes: string;
    locked: boolean; // New field to indicate if period is locked
    required: boolean; // New field for potential F.A. (פוטנציאל פ"א)
}