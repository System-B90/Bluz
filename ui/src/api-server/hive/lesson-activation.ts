import { DbIterations } from "@/api-server/db-iterations";
import { HiveClient } from "@/api-server/hive/client";
import { resolveDesiredRules } from "@/api-server/hive/lesson-sync";
import {
    createHiveServiceClient,
    hasHiveServiceCredentials,
} from "@/api-server/hive/service-client";
import {
    DatabaseController,
    getDatabaseController,
} from "@/api-server/mongo-db-controller";
import {
    DbEventDocument,
    eventOpensHiveQueue,
} from "@/api-shared/types/event";
import { HiveActivationTickResult } from "@/api-shared/types/hive-activation";
import { logger } from "@/logging/pino";

/*
 * Opening the queue when an event goes live.
 *
 * Hive opens a queue when a lesson is assigned to a class: that runs
 * `Lesson.assign()`, which walks the lesson's rules and points every matching
 * student at the rule's queue. Hive assigns lessons by itself only for events
 * it loaded from its ICS mount, which Bluz does not feed — and its Event API
 * is read-only for every clearance, so Bluz cannot put the event there
 * either. So Bluz does the assigning: this tick watches its own calendar and
 * calls `classes/{id}/lesson/` the moment an event starts.
 *
 * Every push is recorded in `hiveLessonActivations` before it is considered
 * done, and the ledger's unique index is the only coordination between
 * replicas.
 */

/** How often the tick runs. Well under the shortest sensible event. */
const TICK_INTERVAL_MS = 30_000;

/**
 * How late an activation may still fire. An event whose start slipped past
 * this — a process that was down all morning, say — is left alone rather than
 * yanking a class onto a lesson that is nearly over.
 */
const MAX_ACTIVATION_LAG_MS = 10 * 60 * 1000;

/**
 * Live, non-hidden events that should open a queue right now.
 *
 * Hidden events are excluded deliberately: they are not shown to students, so
 * they must not move students' work either. Sorted by start time so that when
 * two events overlap for one group, the later one is applied last and wins.
 *
 * @param events Candidate events (already limited to the surrounding window).
 * @param now The moment being evaluated.
 * @returns The events to act on, oldest start first.
 */
export function selectLiveEvents(
    events: Array<DbEventDocument>,
    now: Date,
): Array<DbEventDocument> {
    return events
        .filter((event) => {
            if (event.archived || event.hidden) return false;
            if (!eventOpensHiveQueue(event) || !event.hiveLesson) return false;

            const start = new Date(event.startTime).getTime();
            const end = new Date(event.endTime).getTime();
            const at = now.getTime();
            return (
                start <= at && at < end && at - start <= MAX_ACTIVATION_LAG_MS
            );
        })
        .sort(
            (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime(),
        );
}

/**
 * Runs one activation pass over the current iteration.
 *
 * Idempotent: re-running it inside the same event occurrence assigns nothing
 * further. Never throws — a Hive outage degrades to a logged failure count so
 * the timer keeps ticking and recovers by itself on the next pass.
 *
 * @param now The moment to evaluate (injectable for tests).
 * @param controller Iteration controller; defaults to the current iteration's.
 * @param client Hive client; defaults to the service account.
 * @returns What the pass did.
 */
export async function runLessonActivationTick(
    now: Date = new Date(),
    controller?: DatabaseController,
    client?: HiveClient,
): Promise<HiveActivationTickResult> {
    const result: HiveActivationTickResult = {
        activated: 0,
        alreadyActive: 0,
        consideredEvents: 0,
        errors: [],
        failed: 0,
    };

    if (!client && !hasHiveServiceCredentials()) return result;

    try {
        const db =
            controller ??
            getDatabaseController((await DbIterations.current()).dbName);

        // One tick only ever looks at events around "now"; the lag cap means
        // nothing older can activate anyway.
        const windowStart = new Date(now.getTime() - MAX_ACTIVATION_LAG_MS);
        const windowEnd = new Date(now.getTime() + TICK_INTERVAL_MS);
        const candidates = await db.events
            .find({
                archived: { $ne: true },
                endTime: { $gt: now },
                hidden: { $ne: true },
                startTime: { $gte: windowStart, $lte: windowEnd },
            })
            .toArray();

        const live = selectLiveEvents(candidates, now);
        result.consideredEvents = live.length;
        if (live.length === 0) return result;

        const hive = client ?? (await createHiveServiceClient());
        const [courses, hiveClasses] = await Promise.all([
            db.courses.find({}).toArray(),
            hive.getClasses(),
        ]);
        const courseNameById = new Map(courses.map((c) => [c.id, c.name]));

        for (const event of live) {
            const desired = resolveDesiredRules(
                event,
                courseNameById,
                hiveClasses,
            );
            const occurrenceStart = new Date(event.startTime).toISOString();

            // Assigning a lesson only opens a queue through the lesson's
            // rules, and those are written by the (fire-and-forget) event-time
            // sync. If that sync failed, assigning here would look like a
            // success and open nothing — the one failure mode nobody would
            // notice. Say so instead, and leave the claim unmade so a later
            // tick can still act once the rules land.
            const rules = await hive
                .getLessonRules(event.hiveLesson!)
                .catch(() => null);
            if (rules === null || rules.length === 0) {
                result.failed += 1;
                result.errors.push(
                    `event ${event.id}: lesson ${event.hiveLesson} has no rules — ` +
                        "the event-time Hive sync did not complete, so no queue would open",
                );
                continue;
            }

            for (const hiveClassId of desired.keys()) {
                const claimed = await claimActivation(
                    db,
                    event,
                    hiveClassId,
                    occurrenceStart,
                    now,
                );
                if (!claimed) {
                    result.alreadyActive += 1;
                    continue;
                }

                try {
                    await hive.setLessonForClass(
                        hiveClassId,
                        event.hiveLesson!,
                    );
                    result.activated += 1;
                } catch (error) {
                    // Release the claim so the next tick retries instead of
                    // the ledger recording an opening that never happened.
                    await db.hiveLessonActivations
                        .deleteOne({
                            eventId: event.id,
                            hiveClassId,
                            occurrenceStart,
                        })
                        .catch((releaseError) => {
                            // Both the push and its compensation failed: the
                            // ledger now claims an opening that never
                            // happened, and no later tick will retry it. Only
                            // a human can unstick that, so make it loud.
                            result.errors.push(
                                `event ${event.id} → class ${hiveClassId}: ` +
                                    "activation failed AND its claim could not be released, " +
                                    `so it will not retry: ${String(releaseError)}`,
                            );
                        });
                    result.failed += 1;
                    result.errors.push(
                        `event ${event.id} → class ${hiveClassId}: ${String(error)}`,
                    );
                }
            }
        }
    } catch (error) {
        result.failed += 1;
        result.errors.push(String(error));
    }

    return result;
}

/**
 * Claims one (event, occurrence, group) activation.
 * @returns true when this caller won the claim and must do the Hive call.
 */
async function claimActivation(
    db: DatabaseController,
    event: DbEventDocument,
    hiveClassId: number,
    occurrenceStart: string,
    now: Date,
): Promise<boolean> {
    const claim = await db.hiveLessonActivations.updateOne(
        { eventId: event.id, hiveClassId, occurrenceStart },
        {
            $setOnInsert: {
                activatedAt: now,
                lessonId: event.hiveLesson!,
            },
        },
        { upsert: true },
    );
    return claim.upsertedCount === 1;
}

let timer: NodeJS.Timeout | undefined;

/**
 * Starts the activation timer. Idempotent, and a no-op without service
 * credentials so dev machines and unit runs stay quiet.
 * @example
 * ```typescript
 * startLessonActivationLoop(); // from instrumentation.register()
 * ```
 */
export function startLessonActivationLoop(): void {
    if (timer || process.env.VITEST) return;
    if (!hasHiveServiceCredentials()) {
        logger.info(
            "Hive lesson activation disabled: HIVE_API_USERNAME / HIVE_API_PASSWORD are not set",
        );
        return;
    }

    timer = setInterval(() => {
        void runLessonActivationTick().then((result) => {
            if (result.activated > 0 || result.failed > 0) {
                logger.info({ err: result }, "Hive lesson activation tick");
            }
            for (const error of result.errors) {
                logger.warn({ err: error }, "Hive lesson activation failure:");
            }
        });
    }, TICK_INTERVAL_MS);
    // Never hold the process open for the sake of the timer.
    timer.unref?.();
}

/** Stops the timer (tests, graceful shutdown). */
export function stopLessonActivationLoop(): void {
    if (timer) clearInterval(timer);
    timer = undefined;
}
