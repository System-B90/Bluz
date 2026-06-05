import { Dayjs } from "dayjs";

import { CourseId } from "@/api-shared/types/course";
import { ResolvableRoom } from "@/api-shared/types/room";

/**
 * Standardized Hebrew event types for the calendar engine,
 * fully aligning with the Gantt engine event types.
 */
export enum EventType
{
    EXERCISE = 'ע"ע',
    LECTURE = "הרצאה",
    BREAK = "הפסקה",
    PRAYER = "תפילה",
    OTHER = "אחר",
}

/**
 * Unique identifier for an event, typically a client-generated UUID v4.
 */
export type EventId = string;

/**
 * Identifies a person associated with an event, either a registered user ID (number)
 * or a special external guest string marker.
 */
export type PersonId = "איש חוץ" | number | string;

/**
 * Represents a standard calendar event in the Bluz schedule.
 */
export type Event = {
    id: EventId;
    name: string;
    subject: number; // Subject ID
    hiveModule: number; // Module ID
    startTime: Dayjs;
    endTime: Dayjs;
    type: EventType;
    courses: Array<CourseId>;
    rooms: Array<ResolvableRoom>;
    instructors: Array<number>;
    lecturers?: Array<PersonId>;
    tags: Array<number>;
    notes: string;
    locked: boolean;
    hidden: boolean;
    required: boolean;
    personalTalk: boolean;
};

/**
 * Standardized types of prayers.
 */
export enum PrayerType
{
    SHACHARIT = "shacharit",
    MINCHA = "mincha",
    ARVIT = "arvit",
}

/**
 * Represents a prayer-specific calendar event.
 */
export type PrayerEvent = {
    type: EventType.PRAYER;
    prayerType: PrayerType;
} & Event;

/**
 * Checks if a specific event type is associated with an academic subject.
 * @param type The EventType to check.
 * @returns true if the event type requires a subject, false otherwise.
 * @example
 * ```typescript
 * if (eventHasSubject(event.type)) {
 *   // Render subject and module fields
 * }
 * ```
 */
export function eventHasSubject(type: EventType): boolean
{
    return type === EventType.EXERCISE || type === EventType.LECTURE;
}

/**
 * Checks if an event type is associated with a physical classroom/room.
 * @param type The EventType to check.
 * @returns true if the event type requires a room, false otherwise.
 * @example
 * ```typescript
 * if (eventHasRoom(event.type)) {
 *   // Render room picker field
 * }
 * ```
 */
export function eventHasRoom(type: EventType): boolean
{
    return type !== EventType.PRAYER;
}

/**
 * Translates a prayer type enum value to its displayable Hebrew name.
 * @param prayerType The PrayerType enum value.
 * @returns Hebrew string representing the prayer name.
 * @example
 * ```typescript
 * const label = prayerTypeToHebrew(PrayerType.SHACHARIT); // "שחרית"
 * ```
 */
export function prayerTypeToHebrew(prayerType: PrayerType): string
{
    const LOOKUP: Record<PrayerType, string> = {
        [ PrayerType.SHACHARIT ]: "שחרית",
        [ PrayerType.MINCHA ]: "מנחה",
        [ PrayerType.ARVIT ]: "ערבית",
    };
    return LOOKUP[ prayerType ] ?? prayerType;
}

/**
 * Returns the displayable Hebrew label for a given EventType.
 * Since the EventType enum is standardized to Hebrew values, this returns the value itself.
 * @param type The EventType to translate.
 * @returns The Hebrew display string.
 * @example
 * ```typescript
 * const label = eventTypeToHebrew(event.type); // "הרצאה", "תפילה", etc.
 * ```
 */
export function eventTypeToHebrew(type: EventType): string
{
    return type;
}

/**
 * Compiles a unique list of instructor and lecturer IDs present at an event.
 * @param event The Event object.
 * @param includeOutsiders Optional flag to include "איש חוץ" string marker in the return list.
 * @returns Array of unique PersonIds present at the event.
 * @example
 * ```typescript
 * const attendees = getPresentInstructors(event, true);
 * ```
 */
export function getPresentInstructors(event: Event): Array<number>;
export function getPresentInstructors(
    event: Event,
    includeOutsiders: boolean = false,
): Array<PersonId>
{
    const reduced = new Set<PersonId>([
        ...event.instructors,
        ...(event.lecturers?.filter(
            (v) => typeof v === "number" || includeOutsiders,
        ) ?? []),
    ]);
    return Array.from(reduced);
}

export type DbEventDocument = Omit<Event, "endTime" | "startTime"> & {
    startTime: Date;
    endTime: Date;
};

export type ApiEventGetPayload = void;
export type ApiEventGetResponse = Array<DbEventDocument> | DbEventDocument | null | Record<EventId, Partial<DbEventDocument>>;

export type ApiEventUpdatePayload = DbEventDocument;
export type ApiEventUpdateResponse = DbEventDocument;

export type ApiEventCreatePayload = DbEventDocument;
export type ApiEventCreateResponse = DbEventDocument;

export type ApiEventDeletePayload = EventId;
export type ApiEventDeleteResponse = void;
