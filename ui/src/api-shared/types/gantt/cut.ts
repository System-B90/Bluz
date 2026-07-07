import { ClientApiError } from "@/api-shared/errors";
import { CutValidationError } from "@/api-shared/gantt/cut-planner";

/**
 * API contract for the curriculum → schedule cut ("גזירה ללו"ז", #118).
 * The endpoint materializes a published curriculum's gantt data into schedule
 * events in the linked iteration's MongoDB. All inputs are derived server-side
 * from the curriculum id, so the request carries no payload.
 */

export type ApiCurriculumCutPayload = void;

export type ApiCurriculumCutResponse = {
    /** Number of schedule events created. */
    createdEvents: number;
    /** Courses that were newly created for shuffles during the cut. */
    createdCourses: Array<{ id: string; name: string }>;
    /** Occurrences that overlap each other after stacking (informational). */
    overlaps: number;
};

/** Structured error codes returned when a cut is rejected without writing. */
export type CurriculumCutErrorCode =
    | "already-cut"
    | "draft"
    | "invalid-plan"
    | "no-iteration";

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

/** Narrows a caught {@link ClientApiError} to one carrying a cut error code. */
export function isCurriculumCutErrorPayload(
    error: ClientApiError,
): error is ClientApiError & ApiCurriculumCutError {
    return typeof (error as Partial<ApiCurriculumCutError>).code === "string";
}
