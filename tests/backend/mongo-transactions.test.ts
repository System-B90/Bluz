import { describe, expect, it, vi } from "vitest";
import { logger } from "@/logging/pino";

import {
    isTransactionUnsupportedError,
    withOptionalTransaction,
} from "@/api-server/mongo-transactions";

/**
 * The exact shape a standalone `mongod` produces when the driver opens a
 * transaction against it (#472). The refusal the driver *reports* is about
 * retryable writes; the real reason is nested in `originalError`.
 */
function standaloneTransactionError(): Error {
    const original = Object.assign(
        new Error(
            "Transaction numbers are only allowed on a replica set member or mongos",
        ),
        { code: 20, codeName: "IllegalOperation" },
    );
    return Object.assign(
        new Error(
            "This MongoDB deployment does not support retryable writes. " +
                "Please add retryWrites=false to your connection string.",
        ),
        { originalError: original },
    );
}

/** A minimal MongoClient stand-in whose transaction attempt fails a given way. */
function clientThatFailsWith(error: unknown) {
    return {
        startSession: () => ({
            withTransaction: async () => {
                throw error;
            },
            endSession: async () => {},
        }),
    } as never;
}

describe("isTransactionUnsupportedError", () => {
    it("recognizes the standalone's own IllegalOperation refusal", () => {
        expect(
            isTransactionUnsupportedError({
                code: 20,
                codeName: "IllegalOperation",
            }),
        ).toBe(true);
    });

    it("recognizes the retryable-writes wrapper the driver actually throws", () => {
        expect(isTransactionUnsupportedError(standaloneTransactionError())).toBe(
            true,
        );
    });

    it("recognizes the real reason nested under originalError", () => {
        expect(
            isTransactionUnsupportedError({
                message: "some opaque driver failure",
                originalError: {
                    message:
                        "Transaction numbers are only allowed on a replica set member or mongos",
                },
            }),
        ).toBe(true);
    });

    it("recognizes the reason nested under cause", () => {
        expect(
            isTransactionUnsupportedError({
                message: "wrapped",
                cause: { message: "transactions are not supported" },
            }),
        ).toBe(true);
    });

    it("does not swallow an unrelated failure", () => {
        expect(
            isTransactionUnsupportedError(new Error("duplicate key error")),
        ).toBe(false);
        expect(isTransactionUnsupportedError(null)).toBe(false);
    });

    it("terminates on a self-referential error chain", () => {
        const looping: Record<string, unknown> = { message: "loop" };
        looping.cause = looping;
        expect(isTransactionUnsupportedError(looping)).toBe(false);
    });
});

describe("withOptionalTransaction", () => {
    it("returns the operation's result when the transaction succeeds", async () => {
        const client = {
            startSession: () => ({
                withTransaction: async (fn: () => Promise<unknown>) =>
                    await fn(),
                endSession: async () => {},
            }),
        } as never;

        const result = await withOptionalTransaction(
            client,
            async () => "done",
            "test",
        );
        expect(result).toBe("done");
    });

    it("re-runs the operation without a session on a standalone (#472)", async () => {
        // api-server logs through pino now, not console (#538 item 13).
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
        const operation = vi.fn(async (session?: unknown) =>
            session ? "with-session" : "no-session",
        );

        const result = await withOptionalTransaction(
            clientThatFailsWith(standaloneTransactionError()),
            operation,
            "promoting iteration",
        );

        expect(result).toBe("no-session");
        expect(operation).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("propagates failures that are not about transaction support", async () => {
        await expect(
            withOptionalTransaction(
                clientThatFailsWith(new Error("write conflict")),
                async () => "unreachable",
                "test",
            ),
        ).rejects.toThrow("write conflict");
    });
});
