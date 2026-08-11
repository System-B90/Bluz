import { ClientApiError } from "@/api-shared/errors";
import { CutValidationError } from "@/api-shared/gantt/cut-planner";
import { EventFieldChange } from "@/api-shared/types/event-history";

/**
 * API contract for the schedule reload ("עדכון הלו״ז לפי הגאנט"): re-plans a
 * curriculum that was already cut and reconciles the difference into the linked
 * iteration's schedule.
 *
 * Precedence rule: an event a human touched after the cut wins over the gantt.
 * Such events are reported as conflicts and left untouched unless the user
 * explicitly opts them in (`overrideEventIds`).
 */

/** A planned occurrence that has no schedule event yet — will be created. */
export type ReloadAddition = {
    ganttEventId: string;
    /** yyyy-MM-dd */
    occurrenceDate: string;
    title: string;
    /** ISO datetime. */
    startTime: string;
    /** ISO datetime. */
    endTime: string;
};

/** An existing cut event whose gantt-owned fields drifted from the new plan. */
export type ReloadUpdate = {
    eventId: string;
    ganttEventId: string;
    occurrenceDate: string;
    title: string;
    changes: Array<EventFieldChange>;
};

/** A cut event whose planned occurrence disappeared — will be archived. */
export type ReloadRemoval = {
    eventId: string;
    ganttEventId: string;
    occurrenceDate: string;
    title: string;
};

/** Why a change was withheld: the event carries a manual edit. */
export type ReloadConflictReason = {
    /** Initiator of the last manual change. */
    initiator: string;
    actorName: null | string;
    /** ISO datetime of the last manual change. */
    changedAt: string;
};

/**
 * A gantt change blocked by a manual edit. `kind` mirrors what the reload would
 * have done: rewrite the event's fields, or archive it entirely.
 */
export type ReloadConflict = {
    eventId: string;
    ganttEventId: string;
    occurrenceDate: string;
    title: string;
    kind: "removal" | "update";
    /** Empty for `removal`. */
    changes: Array<EventFieldChange>;
    /** Null when history exists but carries no attributable manual row. */
    lastManualEdit: null | ReloadConflictReason;
};

/** Everything the reload intends to do, before anything is written. */
export type ReloadDiff = {
    additions: Array<ReloadAddition>;
    updates: Array<ReloadUpdate>;
    removals: Array<ReloadRemoval>;
    conflicts: Array<ReloadConflict>;
    /** Occurrences already matching the plan. */
    unchanged: number;
};

export type ApiCurriculumReloadPayload = {
    /** Compute the diff and write nothing. */
    dryRun?: boolean;
    /**
     * Manually-edited events the user chose to overwrite anyway. Their
     * conflicts are applied instead of skipped.
     */
    overrideEventIds?: Array<string>;
    /** Plan around unmapped events / unsatisfied recurrences, as with the cut. */
    force?: boolean;
};

export type ApiCurriculumReloadResponse = {
    /** False for a dry run — the diff is a proposal, nothing was written. */
    applied: boolean;
    diff: ReloadDiff;
    /** Counts of what was actually written (all zero on a dry run). */
    addedEvents: number;
    updatedEvents: number;
    removedEvents: number;
    /** Conflicts left untouched because the user did not override them. */
    skippedConflicts: number;
    /** Courses newly created for shuffles introduced since the cut. */
    createdCourses: Array<{ id: string; name: string }>;
};

/** Structured error codes returned when a reload is rejected without writing. */
export type CurriculumReloadErrorCode =
    | "draft"
    | "invalid-plan"
    | "no-iteration"
    | "not-cut";

export type ApiCurriculumReloadError = {
    code: CurriculumReloadErrorCode;
    /** Present for `invalid-plan`: the pure planner's validation errors. */
    errors?: Array<CutValidationError>;
    message?: string;
};

/**
 * Thrown by the client wrapper when a reload is rejected, carrying the coded
 * reason so the dialog renders a specific Hebrew message.
 */
export class CurriculumReloadError
    extends ClientApiError
    implements ApiCurriculumReloadError
{
    readonly code: CurriculumReloadErrorCode;
    readonly errors?: Array<CutValidationError>;

    constructor(payload: ApiCurriculumReloadError) {
        super(payload.message ?? 'עדכון הלו"ז מהגאנט נכשל');
        this.name = "CurriculumReloadError";
        this.code = payload.code;
        this.errors = payload.errors;
    }
}

/** Narrows a caught {@link ClientApiError} to one carrying a reload code. */
export function isCurriculumReloadErrorPayload(
    error: ClientApiError,
): error is ApiCurriculumReloadError & ClientApiError {
    return typeof (error as Partial<ApiCurriculumReloadError>).code === "string";
}
