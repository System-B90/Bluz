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
