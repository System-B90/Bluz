import {
    DEFAULT_ITERATION_DB_NAME,
    getDatabaseController,
    getMetaController,
    setCurrentIterationDbName,
} from "@/api-server/mongo-db-controller";
import { ClientApiError } from "@/api-shared/errors";
import {
    Iteration,
    IterationId,
    PatchIterationPayload,
    RegisterIterationPayload,
} from "@/api-shared/types/iteration";

function stripMongoId(iteration: any): Iteration {
    const { _id: _ignored, ...rest } = iteration ?? {};
    return rest as Iteration;
}

/**
 * One-off migration: make sure the `bluz_meta.iterations` registry exists and
 * holds the existing `bluz` database as the first, current iteration. No
 * documents are moved — the existing data stays exactly where it is.
 * Uses upsert to avoid a TOCTOU race on concurrent cold starts.
 */
async function ensureSeeded(): Promise<void> {
    const meta = getMetaController();
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

async function getCurrentIteration(): Promise<Iteration> {
    await ensureSeeded();
    const current = await getMetaController().iterations.findOne({
        isCurrent: true,
    });
    if (!current) {
        throw new ClientApiError("No current iteration is configured!");
    }
    return stripMongoId(current);
}

async function getIteration(id: IterationId): Promise<Iteration | null> {
    await ensureSeeded();
    const doc = await getMetaController().iterations.findOne({ id });
    return doc ? stripMongoId(doc) : null;
}

function deriveDbName(id: IterationId): string {
    // Keep db names deterministic and safe for Mongo (alnum + underscore).
    const safe = id.replace(/[^a-zA-Z0-9_]/g, "_");
    return `bluz_${safe}`;
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
    const iteration: Iteration = {
        id: payload.id,
        label: payload.label,
        dbName: payload.dbName ?? deriveDbName(payload.id),
        hiveUrl: payload.hiveUrl,
        hiveCache: payload.hiveCache,
        startDate: payload.startDate ?? now,
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

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.label !== undefined) update.label = patch.label;
    if (patch.hiveUrl !== undefined) update.hiveUrl = patch.hiveUrl;
    if (patch.endDate !== undefined) update.endDate = patch.endDate;
    if (patch.ganttCurriculumId !== undefined) {
        update.ganttCurriculumId = patch.ganttCurriculumId;
    }

    if (patch.isCurrent === true) {
        update.isCurrent = true;
        const session = meta.client.startSession();
        try {
            await session.withTransaction(async () => {
                await meta.iterations.updateMany(
                    { isCurrent: true },
                    { $set: { isCurrent: false, updatedAt: new Date() } },
                    { session },
                );
                await meta.iterations.updateOne(
                    { id },
                    { $set: update },
                    { session },
                );
            });
        } finally {
            await session.endSession();
        }
        // Update in-process cache only after the transaction commits.
        setCurrentIterationDbName(existing.dbName);
    } else {
        await meta.iterations.updateOne({ id }, { $set: update });
    }

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
    export const get = getIteration;
    export const register = registerIteration;
    export const patch = patchIteration;
    export const assertWritable = assertWritableIteration;
}
