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
    WORKSHOP = "סדנה",
    SELF_TEACHING = 'ל"ע',
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
    hiveLesson?: null | number; // Lesson ID
    /**
     * Per-shuffle Hive queue mapping: Bluz course id → Hive queue id. A course
     * is a shuffle, which is 1:1 with a Hive student group, so this is what
     * decides *which students* get *which queue* when the event goes live.
     *
     * Setting it makes Bluz own a Hive lesson for this event: on every write
     * `api-server/hive/lesson-sync` reconciles a `Lesson` under `hiveModule`
     * plus one `LessonRule` per mapped shuffle, and stores the lesson id back
     * into `hiveLesson`. Clearing it (or archiving the event) deletes them.
     */
    hiveQueues?: Record<CourseId, number>;
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
    /**
     * When true, a break (הפסקה) the event runs into interrupts it instead of
     * overlapping it: the event pauses at the break's start and resumes when
     * it ends, as many times as needed.
     *
     * This changes only how the event is *drawn*. `startTime` and `endTime`
     * always describe the net working span, so an event's duration can never
     * change as a side effect of a break being added, moved or removed — the
     * calendar simply re-lays it out. See `api-shared/break-windows.ts`.
     */
    splitAcrossBreaks: boolean;
    color?: string;
    /**
     * "פיקטיבי" marker (issue #102): shown to students as a normal event but
     * acts as a placeholder for Checkers/Segel. Fake events are not wired to
     * a Hive subject/module/lesson — they carry only a manual color override
     * and a comment.
     */
    fake?: boolean;
    /**
     * Gantt event this schedule event was cut from (גזירה ללו"ז); absent for
     * normal events. Set by the curriculum cut endpoint (#118).
     */
    ganttEventId?: string;
    /**
     * ISO date (yyyy-MM-dd) of the planned occurrence — disambiguates
     * recurrence occurrences of the same gantt event. Absent for normal events.
     */
    ganttOccurrenceDate?: string;
    /**
     * Client-stamped revision (epoch ms) set at save time (#156). Used as an
     * optimistic-concurrency guard: an incoming upsert (server resolve echo or
     * WS broadcast) is applied only when strictly newer than the copy already
     * in state, so a self-echo or a stale broadcast can never overwrite a newer
     * local edit. Absent on legacy events (treated as always-overwritable).
     */
    updatedAt?: number;
};

/**
 * The shuffles (Bluz course ids) of an event that carry a Hive queue, i.e. the
 * groups whose students should get a queue opened when the event goes live.
 * Only courses the event is actually assigned to count — a stale mapping left
 * behind by removing a course must not open a queue for it.
 * @param event The event to inspect.
 * @returns The mapped course ids, in the event's own course order.
 */
export function eventQueueCourseIds(
    event: Pick<Event, "courses" | "hiveQueues">,
): Array<CourseId>
{
    const queues = event.hiveQueues;
    if (!queues) return [];
    return event.courses.filter((courseId) => Boolean(queues[ courseId ]));
}

/**
 * True when an event opens a Hive queue for at least one shuffle — the gate
 * for both the lesson sync and the go-live activator.
 * @param event The event to inspect.
 * @returns Whether the event has a usable queue mapping.
 */
export function eventOpensHiveQueue(
    event: Pick<Event, "courses" | "hiveModule" | "hiveQueues">,
): boolean
{
    return Boolean(event.hiveModule) && eventQueueCourseIds(event).length > 0;
}

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
    return (
        type === EventType.EXERCISE ||
        type === EventType.LECTURE ||
        type === EventType.WORKSHOP ||
        type === EventType.SELF_TEACHING
    );
}

/**
 * Checks if an event type carries a `lecturers` selection (lectures have
 * "מרצים"; workshops reuse the same field, labeled "מנהלים").
 * @param type The EventType to check.
 * @returns true if the lecturers field applies to this event type.
 */
export function eventHasLecturers(type: EventType): boolean
{
    return type === EventType.LECTURE || type === EventType.WORKSHOP;
}

/**
 * The display label for the `lecturers` field of a given event type:
 * workshops (סדנה) have "מנהלים" while lectures have "מרצים". The selection
 * source (instructors and outsiders) is identical.
 * @param type The EventType whose label is needed.
 * @returns The Hebrew field label.
 */
export function lecturersLabelForType(type: EventType): string
{
    return type === EventType.WORKSHOP ? "מנהלים" : "מרצים";
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
 * Default value for `splitAcrossBreaks` when an event's type is picked/changed:
 * on for exercises and workshops, off for everything else (lectures included).
 * @param type The EventType to check.
 * @returns The default `splitAcrossBreaks` value for that type.
 */
export function defaultSplitAcrossBreaks(type: EventType): boolean
{
    return type === EventType.EXERCISE || type === EventType.WORKSHOP;
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
export function getPresentInstructors(
    event: Pick<Event, "instructors" | "lecturers">,
): Array<number>;
export function getPresentInstructors(
    event: Pick<Event, "instructors" | "lecturers">,
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
    /**
     * Soft-delete marker. When `true` the event has been archived (deleted by
     * the user) and must be excluded from all active views. Absent/`false`
     * means the event is live.
     */
    archived?: boolean;
};

export type ApiEventGetPayload = void;
export type ApiEventGetResponse =
    | Array<DbEventDocument>
    | DbEventDocument
    | null
    | Record<EventId, Partial<DbEventDocument>>;

export type ApiEventUpdatePayload = DbEventDocument;
export type ApiEventUpdateResponse = DbEventDocument;

export type ApiEventCreatePayload = DbEventDocument;
export type ApiEventCreateResponse = DbEventDocument;

export type ApiEventDeletePayload = EventId;
export type ApiEventDeleteResponse = void;
