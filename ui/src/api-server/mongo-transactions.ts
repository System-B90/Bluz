import { ClientSession, MongoClient } from "mongodb";

/**
 * Mongo multi-document transactions require the server to run as a replica
 * set. A standalone `mongod` — which is how some deployments (and every plain
 * `docker run mongo`) are set up — rejects them outright, and the driver error
 * used to escape uncaught and surface as a bare HTTP 500 (#435).
 */
export function isTransactionUnsupportedError(error: unknown): boolean {
    const candidate = error as {
        code?: number | string;
        codeName?: string;
        message?: string;
    } | null;
    if (!candidate) return false;

    // `IllegalOperation` (code 20) is what a standalone answers with.
    if (candidate.codeName === "IllegalOperation" || candidate.code === 20) {
        return true;
    }
    return /replica set|transaction numbers are only allowed|transactions are not supported/i.test(
        candidate.message ?? "",
    );
}

/**
 * Run `operation` inside a transaction, falling back to running it without one
 * when the deployment does not support transactions.
 *
 * The fallback is not equivalent — the writes stop being atomic — so it is only
 * a degradation, never a silent equivalence: it logs loudly, and callers must
 * order their writes so that a crash midway leaves a tolerable state.
 */
export async function withOptionalTransaction<T>(
    client: MongoClient,
    operation: (session?: ClientSession) => Promise<T>,
    context: string,
): Promise<T> {
    const session = client.startSession();
    try {
        let result: T | undefined;
        await session.withTransaction(async () => {
            result = await operation(session);
        });
        return result as T;
    } catch (error: unknown) {
        if (!isTransactionUnsupportedError(error)) throw error;
        console.warn(
            `[mongo] ${context}: this Mongo deployment is not a replica set, ` +
                `so the operation ran without a transaction and was not atomic. ` +
                `Convert Mongo to a single-node replica set to restore atomicity.`,
        );
        return await operation(undefined);
    } finally {
        await session.endSession();
    }
}
