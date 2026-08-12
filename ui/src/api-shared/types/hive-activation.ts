/**
 * Name: hive-activation.ts
 * Purpose: Shared types for opening a Hive queue when a Bluz event goes live.
 * Created: 2026-08-13
 * Author: Michael K. Steinberg
 */

import { EventId } from "@/api-shared/types/event";

/**
 * One recorded queue opening: the activator pushed `lessonId` onto Hive class
 * `hiveClassId` because event `eventId` started at `occurrenceStart`.
 *
 * The (eventId, hiveClassId, occurrenceStart) triple is uniquely indexed, so
 * inserting the row *is* the claim: a second replica — or the same replica a
 * tick later — loses the insert and does nothing. Moving an event changes
 * `occurrenceStart`, which deliberately re-arms it for its new time.
 */
export type HiveLessonActivation = {
    eventId: EventId;
    hiveClassId: number;
    /** ISO timestamp of the event start this activation belongs to. */
    occurrenceStart: string;
    lessonId: number;
    /** When Hive accepted the assignment. */
    activatedAt: Date;
};

/** Outcome of one activator pass, surfaced by the status endpoint and tests. */
export type HiveActivationTickResult = {
    /** Live events that carry a queue mapping. */
    consideredEvents: number;
    /** (event, group) pairs newly pushed to Hive in this pass. */
    activated: number;
    /** Pairs skipped because an earlier pass already handled them. */
    alreadyActive: number;
    /** Pairs that could not be pushed (unresolved group, Hive error, …). */
    failed: number;
    /** Human-readable reasons for the failures, for logs and diagnostics. */
    errors: Array<string>;
};
