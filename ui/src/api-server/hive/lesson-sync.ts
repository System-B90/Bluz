import { HiveClient } from "@/api-server/hive/client";
import { createHiveClient } from "@/api-server/hive/session-client";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { CourseId } from "@/api-shared/types/course";
import {
    DbEventDocument,
    eventOpensHiveQueue,
    eventQueueCourseIds,
} from "@/api-shared/types/event";
import { Class, HiveLessonId, LessonRule } from "@/api-shared/types/hive";
import { logger } from "@/logging/pino";

/**
 * Marks a Hive lesson as owned by a Bluz event. Bluz only ever renames,
 * re-rules or deletes lessons carrying its own tag, so a lesson a Segel built
 * by hand and then picked in the event dialog is never rewritten underneath
 * them.
 */
const BLUZ_LESSON_TAG = "bluz-event:";

/** The description Bluz stamps on the lessons it owns. */
export function buildLessonDescription(event: DbEventDocument): string {
    const notes = event.notes?.trim();
    return [`${BLUZ_LESSON_TAG}${event.id}`, notes].filter(Boolean).join("\n");
}

/** True when the lesson description marks it as owned by the given event. */
export function isLessonOwnedByEvent(
    description: string | undefined,
    eventId: string,
): boolean {
    return (description ?? "").startsWith(`${BLUZ_LESSON_TAG}${eventId}`);
}

export type LessonRulePlan = {
    create: Array<{ classId: number; queueId: number }>;
    update: Array<{ classId: number; queueId: number; ruleId: number }>;
    delete: Array<number>;
};

/**
 * Diffs the shuffle→queue mapping an event wants against the rules a Hive
 * lesson already has.
 *
 * Bluz owns every rule on a lesson it manages, so anything it does not
 * recognise is removed: a rule for a group that is no longer on the event, a
 * nested rule (Bluz never builds hierarchies), and any duplicate rule for a
 * group. Kept pure so the reconciliation is testable without a Hive.
 *
 * @param desired Hive student-group id → Hive queue id.
 * @param existing The lesson's current rules, as Hive returns them.
 * @returns The rules to create, re-point, and delete.
 */
export function planLessonRules(
    desired: Map<number, number>,
    existing: Array<LessonRule>,
): LessonRulePlan {
    const plan: LessonRulePlan = { create: [], delete: [], update: [] };
    const seen = new Set<number>();

    for (const rule of existing) {
        const groups = rule.student_groups ?? [];
        const classId = groups.length === 1 ? groups[0] : undefined;
        const queueId =
            classId === undefined ? undefined : desired.get(classId);

        // Nested, multi-group, unmapped or duplicated → not ours to keep.
        if (
            rule.parent_rule ||
            classId === undefined ||
            queueId === undefined ||
            seen.has(classId)
        ) {
            plan.delete.push(rule.id);
            continue;
        }

        seen.add(classId);
        if (rule.queue !== queueId) {
            plan.update.push({ classId, queueId, ruleId: rule.id });
        }
    }

    for (const [classId, queueId] of desired) {
        if (!seen.has(classId)) plan.create.push({ classId, queueId });
    }

    return plan;
}

/**
 * Resolves an event's shuffle→queue mapping into Hive ids.
 *
 * A Bluz course *is* a shuffle and a shuffle is 1:1 with a Hive student group,
 * matched by name — the same rule the curriculum cut uses when it creates
 * courses for shuffles. A course with no matching Hive group contributes
 * nothing rather than failing the whole sync.
 *
 * @param event The event carrying `hiveQueues`.
 * @param courseNameById Bluz course id → course (shuffle) name.
 * @param hiveClasses Hive student groups.
 * @returns Hive student-group id → Hive queue id.
 */
export function resolveDesiredRules(
    event: DbEventDocument,
    courseNameById: Map<CourseId, string>,
    hiveClasses: Array<Class>,
): Map<number, number> {
    const classIdByName = new Map(hiveClasses.map((c) => [c.name, c.id]));
    const desired = new Map<number, number>();

    for (const courseId of eventQueueCourseIds(event)) {
        const name = courseNameById.get(courseId);
        const classId = name === undefined ? undefined : classIdByName.get(name);
        const queueId = event.hiveQueues?.[courseId];
        if (classId !== undefined && queueId) desired.set(classId, queueId);
    }

    return desired;
}

/**
 * Brings the Hive lesson of a single event in line with the event: creates it
 * when the event first gets a queue mapping, re-points its rules when the
 * mapping changes, and deletes it when the mapping (or the event) goes away.
 *
 * Runs with the editing Segel's own Hive credentials, at event write time —
 * the queue itself is opened later by the activator (`lesson-activation`).
 *
 * @param client A Hive client built from the editing user's session.
 * @param event The event as stored.
 * @param action Whether the event still exists or has just been removed.
 * @param controller The iteration's Mongo controller (for course names).
 * @returns The lesson id now backing the event, or null when it has none.
 */
export async function reconcileEventLesson(
    client: HiveClient,
    event: DbEventDocument,
    action: "delete" | "upsert",
    controller: DatabaseController = databaseController,
): Promise<HiveLessonId | null> {
    const wanted =
        action === "upsert" && !event.archived && eventOpensHiveQueue(event);

    if (!wanted) {
        return await deleteOwnedLesson(client, event);
    }

    const courses = await controller.courses.find({}).toArray();
    const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
    const desired = resolveDesiredRules(
        event,
        courseNameById,
        await client.getClasses(),
    );
    if (desired.size === 0) {
        return await deleteOwnedLesson(client, event);
    }

    const lessonId = await ensureLesson(client, event);
    const plan = planLessonRules(
        desired,
        await client.getLessonRules(lessonId),
    );

    await Promise.all([
        ...plan.delete.map((ruleId) => client.deleteLessonRule(lessonId, ruleId)),
        ...plan.update.map(({ classId, queueId, ruleId }) =>
            client.patchLessonRule(lessonId, ruleId, {
                queue: queueId,
                student_groups: [classId],
            }),
        ),
        ...plan.create.map(({ classId, queueId }) =>
            client.createLessonRule(lessonId, {
                queue: queueId,
                student_groups: [classId],
            }),
        ),
    ]);

    return lessonId;
}

/**
 * Fire-and-forget wrapper hung off the event write routes, mirroring how
 * Google Calendar sync is attached: it runs with the editing Segel's Hive
 * credentials and can never fail the Bluz write it accompanies. The lesson id
 * it settles on is written straight back onto the stored event, without going
 * through `DbEvent.set` — that would re-enter this sync.
 *
 * @param event The event as stored.
 * @param action Whether the event still exists or was just deleted.
 * @param controller The iteration's Mongo controller.
 * @example
 * ```typescript
 * syncEventLessonToHive(updated, "upsert", controller);
 * ```
 */
export function syncEventLessonToHive(
    event: DbEventDocument,
    action: "delete" | "upsert",
    controller: DatabaseController = databaseController,
): void {
    void (async () => {
        try {
            const client = await createHiveClient();
            const lessonId = await reconcileEventLesson(
                client,
                event,
                action,
                controller,
            );

            if (action === "upsert" && lessonId !== (event.hiveLesson ?? null)) {
                await controller.events.updateOne(
                    { id: event.id },
                    { $set: { hiveLesson: lessonId } },
                );
            }

            // Nobody watches this run, and a queue that silently fails to open
            // is the failure mode that matters — so say what happened.
            logger.info(
                `Hive lesson sync (${action}) for event ${event.id}: lesson ${lessonId ?? "none"}`,
            );
        } catch (error) {
            logger.warn({ err: error }, "Hive lesson sync skipped:");
        }
    })();
}

/**
 * The lesson Bluz owns for an event, if it has one.
 *
 * Found by the ownership tag in the description rather than by the event's
 * `hiveLesson` field: that field travels through the browser, so a client
 * saving a copy of the event it loaded before the sync ran would otherwise
 * orphan the lesson and make the next save build a duplicate. Hive is the
 * source of truth for what Bluz already created.
 */
async function findOwnedLesson(
    client: HiveClient,
    event: DbEventDocument,
): Promise<HiveLessonId | null> {
    if (event.hiveLesson) {
        const byId = await client.getLesson(event.hiveLesson).catch(() => null);
        if (byId && isLessonOwnedByEvent(byId.description, event.id)) {
            return byId.id;
        }
    }

    if (!event.hiveModule) return null;
    const lessons = await client
        .getLessons({ module__id: event.hiveModule })
        .catch(() => []);
    const owned = lessons.find((lesson) =>
        isLessonOwnedByEvent(lesson.description, event.id),
    );
    return owned?.id ?? null;
}

/**
 * The lesson id for an event, creating or updating it as needed. Lesson names
 * are unique per subject in Hive, so a clash falls back to a name suffixed
 * with the event's short id rather than failing the sync.
 */
async function ensureLesson(
    client: HiveClient,
    event: DbEventDocument,
): Promise<HiveLessonId> {
    const payload = {
        description: buildLessonDescription(event),
        module: event.hiveModule,
        name: event.name,
    };

    const ownedId = await findOwnedLesson(client, event);
    if (ownedId !== null) {
        await client.patchLesson(ownedId, payload);
        return ownedId;
    }

    // A lesson the Segel picked by hand is used as-is: Bluz adds rules to it
    // but never renames or deletes what it did not create.
    if (event.hiveLesson) {
        const picked = await client.getLesson(event.hiveLesson).catch(() => null);
        if (picked) return picked.id;
    }

    try {
        return (await client.createLesson(payload)).id;
    } catch (error) {
        // Only a rejected *payload* is worth retrying under another name. A
        // 401, a 500 or a dead socket would fail again identically, and
        // swallowing them here would turn a Hive outage into a mystery
        // duplicate-name error one round-trip later.
        if (!isBadRequest(error)) throw error;

        const created = await client.createLesson({
            ...payload,
            name: `${event.name} (${event.id.slice(0, 8)})`,
        });
        return created.id;
    }
}

/**
 * Whether a Hive client error came from a 400.
 *
 * `@system-b90/hive-core` puts only `statusText` in the message — no status
 * code and no response body — so this matches on that text. It is coarse by
 * necessity: it stays true for every 400 regardless of which field Hive
 * objected to, but 401/500/network failures carry their own distinct
 * messages and are correctly excluded.
 */
function isBadRequest(error: unknown): boolean {
    return (
        error instanceof Error && error.message.includes("Bad Request")
    );
}

/**
 * Deletes the event's lesson, but only if Bluz created it for this event.
 *
 * @returns The lesson id the event should keep: a hand-picked lesson the
 * Segel chose survives (Bluz never owned it), while a Bluz-owned lesson that
 * was just deleted — or a `hiveLesson` that pointed at it — is cleared.
 */
async function deleteOwnedLesson(
    client: HiveClient,
    event: DbEventDocument,
): Promise<HiveLessonId | null> {
    const picked = event.hiveLesson ?? null;
    const ownedId = await findOwnedLesson(client, event);
    if (ownedId === null) return picked;
    await client.deleteLesson(ownedId);
    return ownedId === picked ? null : picked;
}
