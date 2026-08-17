import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export enum ModuleEventType {
    Lecture = "הרצאה",
    Exercise = 'ע"ע',
    SelfTeaching = 'ל"ע',
    Other = "אחר",
}

export enum RoomRequirement {
    Classified = "בחדר מסווג",
    Outside = "בחוץ",
    MultipleClassrooms = "כמה כיתות",
    OffBase = "מחוץ לבסיס",
    Online = "באופן מקוון",
}

export enum EventRecurrence {
    None = "none",
    Daily = "daily",
    Weekly = "weekly",
}

export type GanttEvent = {
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    /** Hive id of the responsible instructor ("אחראי"); null when unassigned. */
    orchestratorId: null | number;
    /** Outsider IDs, ordered by recommendation priority (top = most recommended). */
    recommendedLecturerIds: Array<string>;
    /** Free-text system requirements. */
    systemRequirements: Array<string>;
    roomRequirement: RoomRequirement;
    recurrence: EventRecurrence;
    /**
     * First date the recurrence may echo onto ("YYYY-MM-DD"), or null for "from
     * wherever the event is mapped". Lets a recurring event start mid-course
     * instead of being pinned to the first week (#468).
     */
    recurrenceStartDate: null | string;
    /**
     * Last date the recurrence may echo onto ("YYYY-MM-DD"), or null for "to the
     * end of the timeline" (#468).
     */
    recurrenceEndDate: null | string;
    /** Marked קריטי. */
    isCritical: boolean;
    /** Marked חלון פ"א. */
    isPaWindow: boolean;
    /**
     * When true and this event overlaps a meal/break window during cutting,
     * it's split around the break instead of bumped past it: runs up to the
     * break's start, then resumes after it ends.
     */
    splitAcrossBreaks: boolean;
    comment: null | string;
    constraints: Array<GanttConstraint>;
    /**
     * Shuffle names (from the parent syllabus) this event applies to.
     * Empty/undefined ⇒ applies to all shuffles.
     */
    shuffles?: Array<string>;
    /** Hive subject id; null when unlinked. */
    hiveSubjectId: null | number;
    /** Hive module id; null when unlinked. */
    hiveModuleId: null | number;
    /** Hive lesson id; null when unlinked. */
    hiveLessonId: null | number;
} & BaseGantItem;
export type GanttEventId = GanttEvent["id"];

/**
 * Default value for `splitAcrossBreaks` when an event's type is picked/changed:
 * on for exercises, off for everything else.
 * @param type The ModuleEventType to check.
 * @returns The default `splitAcrossBreaks` value for that type.
 */
export function defaultSplitAcrossBreaks(type: ModuleEventType): boolean
{
    return type === ModuleEventType.Exercise;
}
