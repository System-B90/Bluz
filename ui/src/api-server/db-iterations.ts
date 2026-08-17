import {
    DEFAULT_ITERATION_DB_NAME,
    getDatabaseController,
    getMetaController,
    setCurrentIterationDbName,
} from "@/api-server/mongo-db-controller";
import { withOptionalTransaction } from "@/api-server/mongo-transactions";
import { ClientApiError } from "@/api-shared/errors";
import {
    HiveIterationCache,
    Iteration,
    IterationId,
    IterationUsage,
    PatchIterationPayload,
    RegisterIterationPayload,
} from "@/api-shared/types/iteration";

function stripMongoId(iteration: any): Iteration {
    const { _id: _ignored, ...rest } = iteration ?? {};
    return rest as Iteration;
}

/**
 * One-off migration for installs that predate the registry: the existing `bluz`
 * database is registered as the first, current iteration so its data stays
 * reachable. No documents are moved.
 *
 * A *fresh* install is deliberately left with an empty registry (#471) — an
 * auto-created "current" iteration has no real name or id, and its literal id
 * collided with the `/api/iterations/current` route segment (#472). The UI
 * prompts for a real iteration instead.
 *
 * Uses upsert to avoid a TOCTOU race on concurrent cold starts.
 */
async function ensureSeeded(): Promise<void> {
    const meta = getMetaController();
    const anyIteration = await meta.iterations.findOne(
        {},
        { projection: { _id: 1 } },
    );
    if (anyIteration) return;

    // Empty registry: migrate only when the default database already holds
    // calendar data, i.e. this is an upgrade rather than a first boot.
    const legacyEvent = await getDatabaseController(DEFAULT_ITERATION_DB_NAME)
        .events.findOne({}, { projection: { _id: 1 } });
    if (!legacyEvent) return;

    const now = new Date();
    const result = await meta.iterations.updateOne(
        { id: "current" },
        {
            $setOnInsert: {
                id: "current",
                label: "מחזור נוכחי",
                dbName: DEFAULT_ITERATION_DB_NAME,
                startDate: now,
                endDate: null,
                isCurrent: true,
                createdAt: now,
                updatedAt: now,
            } as Iteration,
        },
        { upsert: true },
    );
    if (result.upsertedCount > 0) {
        setCurrentIterationDbName(DEFAULT_ITERATION_DB_NAME);
    }
}

async function listIterations(): Promise<Array<Iteration>> {
    await ensureSeeded();
    const docs = await getMetaController()
        .iterations.find({})
        .sort({ startDate: -1 })
        .toArray();
    return docs.map(stripMongoId);
}

/**
 * The current iteration, or null when the registry is still empty — a fresh
 * install before the user has created their first iteration (#471). Read paths
 * use this and prompt; write paths use {@link getCurrentIteration}, which
 * refuses to guess.
 */
async function getCurrentIterationOrNull(): Promise<Iteration | null> {
    await ensureSeeded();
    const current = await getMetaController().iterations.findOne({
        isCurrent: true,
    });
    return current ? stripMongoId(current) : null;
}

async function getCurrentIteration(): Promise<Iteration> {
    const current = await getCurrentIterationOrNull();
    if (!current) {
        throw new ClientApiError("No current iteration is configured!");
    }
    return current;
}

async function getIteration(id: IterationId): Promise<Iteration | null> {
    await ensureSeeded();
    const doc = await getMetaController().iterations.findOne({ id });
    return doc ? stripMongoId(doc) : null;
}

/**
 * Find the iteration linked to a given Postgres curriculum, i.e. the iteration
 * whose `ganttCurriculumId` equals `curriculumId`. Used by the curriculum cut
 * (#118) to locate the target schedule database. Returns null when nothing is
 * linked.
 */
async function getIterationByCurriculum(
    curriculumId: string,
): Promise<Iteration | null> {
    await ensureSeeded();
    const doc = await getMetaController().iterations.findOne({
        ganttCurriculumId: curriculumId,
    });
    return doc ? stripMongoId(doc) : null;
}

function deriveDbName(id: IterationId): string {
    // Keep db names deterministic and safe for Mongo (alnum + underscore).
    const safe = id.replace(/[^a-zA-Z0-9_]/g, "_");
    return `bluz_${safe}`;
}

/** Throws unless `end` is strictly after `start` (null end ⇒ open-ended, always valid). */
function assertDateOrder(
    start: Date | string,
    end: Date | null | string | undefined,
): void {
    if (end === null || end === undefined) return;
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (endMs <= startMs) {
        throw new ClientApiError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
    }
}

/**
 * Register a new iteration and lazily provision its database. Mongo creates the
 * database on first write, so no explicit creation is needed here.
 */
async function registerIteration(
    payload: RegisterIterationPayload,
): Promise<Iteration> {
    await ensureSeeded();
    if (!payload.id || !payload.label) {
        throw new ClientApiError("Iteration id and label are required!");
    }

    const meta = getMetaController();
    const clash = await meta.iterations.findOne({ id: payload.id });
    if (clash) {
        throw new ClientApiError(`Iteration "${payload.id}" already exists!`);
    }

    const now = new Date();
    const startDate = payload.startDate ?? now;
    assertDateOrder(startDate, payload.endDate);
    const iteration: Iteration = {
        id: payload.id,
        label: payload.label,
        dbName: payload.dbName ?? deriveDbName(payload.id),
        hiveUrl: payload.hiveUrl,
        hiveCache: payload.hiveCache,
        startDate,
        endDate: payload.endDate ?? null,
        isCurrent: false,
        ganttCurriculumId: payload.ganttCurriculumId,
        createdAt: now,
        updatedAt: now,
    };

    await meta.iterations.insertOne(iteration as Iteration);
    // Touch the new database so it shows up immediately.
    getDatabaseController(iteration.dbName);
    return iteration;
}

/**
 * Patch an iteration. Setting `isCurrent: true` atomically demotes whichever
 * iteration was previously current, so exactly one stays current.
 */
async function patchIteration(
    id: IterationId,
    patch: PatchIterationPayload,
): Promise<Iteration> {
    await ensureSeeded();
    const meta = getMetaController();
    const existing = await meta.iterations.findOne({ id });
    if (!existing) {
        throw new ClientApiError(`Iteration "${id}" not found!`);
    }

    const effectiveStart = patch.startDate ?? existing.startDate;
    const effectiveEnd =
        patch.endDate !== undefined ? patch.endDate : existing.endDate;
    assertDateOrder(effectiveStart, effectiveEnd);

    const update: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Partial<Record<keyof Iteration, "">> = {};
    if (patch.label !== undefined) update.label = patch.label;
    if (patch.hiveUrl !== undefined) update.hiveUrl = patch.hiveUrl;
    if (patch.startDate !== undefined) update.startDate = patch.startDate;
    if (patch.endDate !== undefined) update.endDate = patch.endDate;
    if (patch.ganttCurriculumId !== undefined) {
        if (patch.ganttCurriculumId === null) {
            unset.ganttCurriculumId = "";
        } else {
            update.ganttCurriculumId = patch.ganttCurriculumId;
        }
    }

    if (patch.isCurrent === true) {
        update.isCurrent = true;
        await withOptionalTransaction(
            meta.client,
            async (session) => {
                // Demote first, promote second. Without a transaction (a
                // standalone Mongo) a crash between the two leaves zero current
                // iterations, which the next request re-seeds, rather than two,
                // which nothing resolves on its own.
                await meta.iterations.updateMany(
                    { isCurrent: true },
                    { $set: { isCurrent: false, updatedAt: new Date() } },
                    { session },
                );
                await meta.iterations.updateOne(
                    { id },
                    Object.keys(unset).length > 0
                        ? { $set: update, $unset: unset }
                        : { $set: update },
                    { session },
                );
            },
            `promoting iteration "${id}" to current`,
        );
        // Update in-process cache only after the transaction commits.
        setCurrentIterationDbName(existing.dbName);
    } else {
        await meta.iterations.updateOne(
            { id },
            Object.keys(unset).length > 0
                ? { $set: update, $unset: unset }
                : { $set: update },
        );
    }

    const updated = await meta.iterations.findOne({ id });
    if (!updated) {
        throw new ClientApiError(`Iteration "${id}" disappeared during update!`);
    }
    return stripMongoId(updated);
}

/**
 * What still hangs off an iteration. Only a fully orphaned iteration may be
 * deleted (#473), so the UI asks for this to decide whether to enable its
 * delete button rather than letting the user discover the rule from an error.
 */
async function describeIterationUsage(
    id: IterationId,
): Promise<IterationUsage> {
    const iteration = await getIteration(id);
    if (!iteration) {
        throw new ClientApiError(`Iteration "${id}" not found!`);
    }
    const events = await getDatabaseController(
        iteration.dbName,
    ).events.countDocuments({}, { limit: 1 });
    const curriculums = iteration.ganttCurriculumId ? 1 : 0;
    return {
        curriculums,
        events,
        isCurrent: iteration.isCurrent,
        orphaned: !iteration.isCurrent && events === 0 && curriculums === 0,
    };
}

/**
 * Delete an iteration from the registry. Only an orphaned iteration qualifies:
 * the current one is never deletable (there must always be exactly one writable
 * iteration), and neither is one that still owns events or a linked curriculum.
 * The backing Mongo database is left in place — orphaned, not dropped.
 */
async function deleteIteration(id: IterationId): Promise<void> {
    await ensureSeeded();
    const usage = await describeIterationUsage(id);
    if (usage.isCurrent) {
        throw new ClientApiError("לא ניתן למחוק את המחזור הנוכחי");
    }
    if (!usage.orphaned) {
        throw new ClientApiError(
            "לא ניתן למחוק מחזור שמשויכים אליו אירועים או תכנית לימודים",
        );
    }
    await getMetaController().iterations.deleteOne({ id });
}

/**
 * Overwrite an iteration's Hive name cache, e.g. after a manual "sync Hive
 * info" request (#379).
 */
async function setIterationHiveCache(
    id: IterationId,
    hiveCache: HiveIterationCache,
): Promise<Iteration> {
    await ensureSeeded();
    const meta = getMetaController();
    const existing = await meta.iterations.findOne({ id });
    if (!existing) {
        throw new ClientApiError(`Iteration "${id}" not found!`);
    }
    await meta.iterations.updateOne(
        { id },
        { $set: { hiveCache, updatedAt: new Date() } },
    );
    const updated = await meta.iterations.findOne({ id });
    if (!updated) {
        throw new ClientApiError(`Iteration "${id}" disappeared during update!`);
    }
    return stripMongoId(updated);
}

/**
 * Guard for write paths: past iterations are reference-only. Throws unless the
 * resolved iteration is the current one. Omitted id ⇒ current ⇒ writable.
 */
async function assertWritableIteration(id?: IterationId): Promise<void> {
    if (!id) return;
    const iteration = await getIteration(id);
    if (!iteration) {
        throw new ClientApiError(`Unknown iteration "${id}"`);
    }
    if (!iteration.isCurrent) {
        throw new ClientApiError(
            "מחזור קודם הוא לקריאה בלבד ולא ניתן לעריכה",
        );
    }
}

export namespace DbIterations {
    export const ensure = ensureSeeded;
    export const list = listIterations;
    export const current = getCurrentIteration;
    export const currentOrNull = getCurrentIterationOrNull;
    export const usage = describeIterationUsage;
    export const get = getIteration;
    export const getByCurriculum = getIterationByCurriculum;
    export const register = registerIteration;
    export const patch = patchIteration;
    export const remove = deleteIteration;
    export const setHiveCache = setIterationHiveCache;
    export const assertWritable = assertWritableIteration;
}
