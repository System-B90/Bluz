import { ClientSession, MongoClient } from "mongodb";

import { logger } from "@/logging/pino";

/**
 * Mongo multi-document transactions require the server to run as a replica
 * set. A standalone `mongod` — which is how some deployments (and every plain
 * `docker run mongo`) are set up — rejects them outright, and the driver error
 * used to escape uncaught and surface as a bare HTTP 500 (#435).
 */
export function isTransactionUnsupportedError(error: unknown): boolean {
    return isUnsupportedAt(error, 0);
}

/**
 * The driver does not always surface the standalone's own complaint. Opening a
 * transaction on a standalone first trips the retryable-writes check, and the
 * driver reports *that* — "This MongoDB deployment does not support retryable
 * writes" — carrying the real `Transaction numbers are only allowed on a
 * replica set member or mongos` underneath as `originalError` (#472). Matching
 * only the outer message therefore missed the very case this guard exists for,
 * and the error escaped as a bare HTTP 500 on every "make current" switch. So
 * walk the wrapper chain, and treat the retryable-writes refusal as its own
 * signal.
 */
function isUnsupportedAt(error: unknown, depth: number): boolean {
    // Cheap cycle/runaway guard: the chains involved are one or two deep.
    if (!error || depth > 4) return false;

    const candidate = error as {
        cause?: unknown;
        code?: number | string;
        codeName?: string;
        message?: string;
        originalError?: unknown;
    };

    // `IllegalOperation` (code 20) is what a standalone answers with.
    if (candidate.codeName === "IllegalOperation" || candidate.code === 20) {
        return true;
    }
    if (
        /replica set|transaction numbers are only allowed|transactions are not supported|does not support retryable writes/i.test(
            candidate.message ?? "",
        )
    ) {
        return true;
    }

    return (
        isUnsupportedAt(candidate.originalError, depth + 1) ||
        isUnsupportedAt(candidate.cause, depth + 1)
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
        logger.warn(
            `[mongo] ${context}: this Mongo deployment is not a replica set, ` +
                `so the operation ran without a transaction and was not atomic. ` +
                `Convert Mongo to a single-node replica set to restore atomicity.`,
        );
        return await operation(undefined);
    } finally {
        await session.endSession();
    }
}
