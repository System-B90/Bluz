import { ClientApiError } from "@/api-shared/errors";
import {
    CutPlanReport,
    CutSpillDetail,
    CutValidationError,
} from "@/api-shared/gantt/cut-planner";
import { WeekOverflowResolution } from "@/api-shared/gantt/cut-rules";
import { ModuleEventType } from "@/api-shared/types/gantt/models";

/**
 * API contract for the curriculum → schedule cut ("גזירה ללו"ז", #118).
 * The endpoint materializes a published curriculum's gantt data into schedule
 * events in the linked iteration's MongoDB. All inputs are derived server-side
 * from the curriculum id, so the request carries no payload.
 */

export type ApiCurriculumCutPayload = {
    /**
     * Cut anyway despite unmapped events / unsatisfied recurrences (an
     * unfinished gantt). The user explicitly acknowledges the gap; those
     * events are dropped from the cut instead of blocking it.
     */
    force?: boolean;
    /**
     * Rebalance each week so no day exceeds its working window, cascading work
     * forward within the week. Defaults to on.
     */
    autoSpillover?: boolean;
    /**
     * Spread each day's leftover slack through the day as real הפסקה events
     * instead of leaving it as an empty tail. Defaults to on.
     */
    insertBreaks?: boolean;
    /**
     * Event ids whose constraint-solver moves the user accepted in the dialog.
     * Anything not listed is reported but never moved.
     */
    acceptedConstraintMoves?: Array<string>;
    /**
     * The user's answer to each `week-overflow` decision, keyed by week id.
     * Weeks left out fall back to `OVERFLOW_RULES.defaultResolution`.
     */
    weekOverflowResolutions?: Record<string, WeekOverflowResolution>;
};

/**
 * Response of POST .../cut/plan — the "plan" half of the plan-then-confirm
 * flow. Runs the whole pipeline without writing and reports what the cut would
 * do plus every open question, so the dialog can ask them one at a time before
 * committing. Never writes.
 */
export type ApiCurriculumCutPlanResponse =
    | { ok: false; errors: Array<CutValidationError> }
    | {
          ok: true;
          /** Schedule events the commit would create. */
          plannedEvents: number;
          overlaps: number;
          /** What the balancer, break pass and constraint solver did. */
          report: CutPlanReport;
      };

export type ApiCurriculumCutResponse = {
    /** Number of schedule events created. */
    createdEvents: number;
    /** Courses that were newly created for shuffles during the cut. */
    createdCourses: Array<{ id: string; name: string }>;
    /** Occurrences that overlap each other after stacking (informational). */
    overlaps: number;
    /** Events the balancer moved to a later day in the same week. */
    spilledEvents: number;
    /**
     * The same relocations, one entry each, so the dialog can expand the count
     * into exactly what moved and where.
     */
    spills: Array<CutSpillDetail>;
    /** הפסקה events the break post-pass created. */
    insertedBreaks: number;
};

/**
 * A single dated, timed occurrence in a cut preview — the pure planner's
 * output enriched with display metadata. Dates are ISO strings so the payload
 * survives JSON transport; the client re-hydrates with dayjs.
 */
export type ApiCutPreviewOccurrence = {
    ganttEventId: string;
    title: string;
    /** ModuleEventType of the source gantt event. */
    eventType: ModuleEventType;
    /**
     * Hive subject id the source gantt event is linked to, or null when the
     * event is a non-Hive placeholder. Lets the preview color occurrences by
     * their real subject color, matching the actual schedule (#331).
     */
    hiveSubjectId: null | number;
    syllabusTitle: string;
    moduleTitle: string;
    /** ISO date (yyyy-MM-dd) of the occurrence. */
    occurrenceDate: string;
    /** ISO datetime. */
    startTime: string;
    /** ISO datetime. */
    endTime: string;
    /** True when this is a recurrence echo rather than the mapped start day. */
    isRecurrenceEcho: boolean;
    /** True for a break the post-pass invented rather than a gantt event. */
    isGeneratedBreak: boolean;
    /** Which break rule produced it (`BreakKind`), or null for a real event. */
    breakKind: null | string;
    /**
     * True when the balancer relocated this occurrence off the day it was
     * mapped to. Drives the preview's moved/unmoved highlight.
     */
    spilled: boolean;
};

/**
 * Response of GET .../cut/preview — a dry-run of the cut planner. Never
 * writes. `ok: false` carries the planner's validation errors (e.g. missing
 * start date) so the preview UI can explain why nothing renders.
 */
export type ApiCurriculumCutPreviewResponse =
    | { ok: false; errors: Array<CutValidationError> }
    | {
          ok: true;
          occurrences: Array<ApiCutPreviewOccurrence>;
          overlaps: number;
          /** What the balancer, break pass and constraint solver did. */
          report: CutPlanReport;
          /**
           * Events the real cut would reject (unmapped / unsatisfied
           * recurrence) that the preview skipped instead of failing on.
           */
          skipped: Array<CutValidationError>;
      };

/**
 * Cut status for a curriculum, driving the UI toggle between the "cut" and
 * "pull back" actions. `cut` is true when the linked iteration holds any live
 * (non-archived) cut event.
 */
export type ApiCurriculumCutStatus = {
    cut: boolean;
    /** Number of live cut events in the linked iteration. */
    count: number;
};

/**
 * Response for a pull-back: the schedule events generated by a previous cut are
 * soft-deleted (archived) from the linked iteration.
 */
export type ApiCurriculumPullBackResponse = {
    /** Number of schedule events that were soft-deleted. */
    removedEvents: number;
};

/** Structured error codes returned when a cut is rejected without writing. */
export type CurriculumCutErrorCode =
    | "already-cut"
    | "draft"
    | "invalid-plan"
    | "no-iteration";

/** Structured error codes returned when a pull-back is rejected. */
export type CurriculumPullBackErrorCode = "no-iteration" | "not-cut";

export type ApiCurriculumPullBackError = {
    code: CurriculumPullBackErrorCode;
    /** Human-readable Hebrew message describing the rejection. */
    message?: string;
};

export type ApiCurriculumCutError = {
    code: CurriculumCutErrorCode;
    /** Present for `invalid-plan`: the pure planner's collected validation errors. */
    errors?: Array<CutValidationError>;
    /** Present for `already-cut`: how many cut events already exist in the iteration. */
    count?: number;
    /** Human-readable Hebrew message describing the rejection. */
    message?: string;
};

/**
 * Thrown by the client wrapper when a cut is rejected. Carries the full
 * structured payload (code + planner validation errors + already-cut count)
 * so the UI can render a specific message or validation list instead of a
 * generic network error. Extends {@link ClientApiError} so it flows through
 * the shared snackbar handling.
 */
export class CurriculumCutError
    extends ClientApiError
    implements ApiCurriculumCutError
{
    readonly code: CurriculumCutErrorCode;
    readonly errors?: Array<CutValidationError>;
    readonly count?: number;

    constructor(payload: ApiCurriculumCutError) {
        super(payload.message ?? 'גזירת הגאנט ללו"ז נכשלה');
        this.name = "CurriculumCutError";
        this.code = payload.code;
        this.errors = payload.errors;
        this.count = payload.count;
    }
}

/**
 * Every valid {@link CurriculumCutErrorCode}, so the type guard below can
 * check the payload actually carries one of *this* error's codes rather than
 * just "some string" — `CurriculumPullBackErrorCode`/`CurriculumReloadErrorCode`
 * share several code values ("no-iteration", "invalid-plan", ...), so a bare
 * `typeof code === "string"` check can't tell them apart.
 */
const CURRICULUM_CUT_ERROR_CODES: ReadonlySet<string> = new Set<
    CurriculumCutErrorCode
>(["already-cut", "draft", "invalid-plan", "no-iteration"]);

/** Narrows a caught {@link ClientApiError} to one carrying a cut error code. */
export function isCurriculumCutErrorPayload(
    error: ClientApiError,
): error is ClientApiError & ApiCurriculumCutError {
    const { code } = error as Partial<ApiCurriculumCutError>;
    return typeof code === "string" && CURRICULUM_CUT_ERROR_CODES.has(code);
}

/**
 * Thrown by the client wrapper when a pull-back is rejected. Carries the coded
 * reason (no linked iteration / nothing to pull back) so the dialog can render
 * a specific Hebrew message instead of a generic network error.
 */
export class CurriculumPullBackError
    extends ClientApiError
    implements ApiCurriculumPullBackError
{
    readonly code: CurriculumPullBackErrorCode;

    constructor(payload: ApiCurriculumPullBackError) {
        super(payload.message ?? 'משיכת הלו"ז חזרה נכשלה');
        this.name = "CurriculumPullBackError";
        this.code = payload.code;
    }
}

const CURRICULUM_PULL_BACK_ERROR_CODES: ReadonlySet<string> = new Set<
    CurriculumPullBackErrorCode
>(["no-iteration", "not-cut"]);

/** Narrows a caught {@link ClientApiError} to one carrying a pull-back code. */
export function isCurriculumPullBackErrorPayload(
    error: ClientApiError,
): error is ClientApiError & ApiCurriculumPullBackError {
    const { code } = error as Partial<ApiCurriculumPullBackError>;
    return typeof code === "string" && CURRICULUM_PULL_BACK_ERROR_CODES.has(code);
}
