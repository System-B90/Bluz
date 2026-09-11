import { EventId } from "@/api-shared/types/event";

/**
 * The *only* shape of a calendar event a student ("חניך") may ever receive
 * (#656). This is a security boundary, not a display preference: a student
 * session must never be able to obtain any other event field, from any
 * endpoint, by any parameter.
 *
 * Deliberately absent, and why:
 * - `type`, `notes`, `tags`, `required`, `personalTalk`, `locked`,
 *   `splitAcrossBreaks` — staff-only attributes.
 * - `subject`, `hiveModule`, `hiveLesson`, `hiveQueues` — Hive identifiers.
 *   The event *colour* is resolved to a hex string on the server precisely so
 *   the subject id behind it never crosses the wire.
 * - `instructors`, `lecturers` — staff//outsider identities.
 * - `gantt*` — curriculum provenance.
 * - `hidden`, `fake`, `archived` — hidden and archived events are dropped
 *   server-side and never represented here; fake events ("פיקטיבי", #102) are
 *   returned as ordinary events, indistinguishable by construction, because
 *   they are meant to look real to students.
 *
 * Rooms and courses are carried as display names only — never as Hive class
 * ids or Bluz course ids.
 */
export type StudentEvent = {
    /** The event's own UUID. Opaque; used as a render key. */
    id: EventId;
    name: string;
    /** ISO 8601 timestamps. */
    startTime: string;
    endTime: string;
    /** Fully resolved hex colour (e.g. `#3f51b5`), never a colour/subject id. */
    color: string;
    /** Room display names. */
    rooms: Array<string>;
    /** Course / shuffle display names. */
    courses: Array<string>;
};

export type ApiStudentScheduleGetPayload = void;
export type ApiStudentScheduleGetResponse = {
    /** The day the events belong to, `yyyy-MM-dd` in the app timezone. */
    date: string;
    events: Array<StudentEvent>;
};

/**
 * Query param staff may use to preview another day. Ignored — and rejected —
 * for student sessions, which always get the server's own current day.
 */
export const STUDENT_VIEW_DATE_PARAM = "date";

/** The one route a student session is allowed to render. */
export const STUDENT_VIEW_PATH = "/student-view";

/**
 * Focused-time report (#656). The day and the identity are both decided
 * server-side — the client says only *how long*, never who or when.
 */
export type ApiStudentEngagementPostPayload = { seconds: number };
export type ApiStudentEngagementPostResponse = void;

/** How often the board reports accumulated focused time, in milliseconds. */
export const ENGAGEMENT_FLUSH_INTERVAL_MS = 30_000;
