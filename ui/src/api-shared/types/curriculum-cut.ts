import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

/**
 * Ledger row claiming the one-shot cut of a curriculum into an iteration's
 * calendar. The unique index on `curriculumId` *is* the concurrency control:
 * the insert, not a lock, decides which of two concurrent cuts proceeds (#515,
 * the same pattern as `hiveLessonActivations`).
 */
export type CurriculumCutClaim = {
    curriculumId: GanttCurriculumId;
    /** When the claim was taken — an audit trail, not a lease. */
    claimedAt: Date;
};
