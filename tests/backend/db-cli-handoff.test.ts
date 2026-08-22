import { beforeEach, describe, expect, it, vi } from "vitest";

// A 32-byte (64 hex char) key so secret-box.ts's real seal/open runs for
// real, exercising the actual encrypt-at-rest round trip rather than a stub.
process.env.SYM_ENC_KEY = "ab".repeat(32);

vi.mock("@/api-server/mongo-db-controller", () => ({
    getMetaController: vi.fn(),
}));

import { getMetaController } from "@/api-server/mongo-db-controller";
import { DbCliHandoff } from "@/api-server/db-cli-handoff";
import { CliHandoffCode } from "@/api-shared/types/cli-handoff";

/**
 * Minimal in-memory stand-in for the `cliHandoffCodes` Mongo collection,
 * faithful to the two operations db-cli-handoff.ts actually uses:
 * `insertOne` and an atomic `findOneAndDelete` (delete *is* the single-use
 * guard -- a second lookup for the same code finds nothing).
 */
function makeController() {
    const store = new Map<string, CliHandoffCode>();
    return {
        cliHandoffCodes: {
            insertOne: vi.fn(async (doc: CliHandoffCode) => {
                store.set(doc.code, doc);
                return { acknowledged: true };
            }),
            findOneAndDelete: vi.fn(async (filter: { code: string }) => {
                const found = store.get(filter.code);
                if (!found) return null;
                store.delete(filter.code);
                return found;
            }),
        },
        _store: store,
    };
}

let controller: ReturnType<typeof makeController>;
beforeEach(() => {
    vi.useRealTimers();
    controller = makeController();
    vi.mocked(getMetaController).mockReturnValue(controller as never);
});

describe("DbCliHandoff", () => {
    it("mints a code that redeems back to the original session token", async () => {
        const code = await DbCliHandoff.create("session-token-value", "user-1");
        expect(typeof code).toBe("string");
        expect(code.length).toBeGreaterThan(0);

        const token = await DbCliHandoff.redeem(code);
        expect(token).toBe("session-token-value");
    });

    it("never stores the session token in the clear", async () => {
        const code = await DbCliHandoff.create("session-token-value", "user-1");
        const stored = controller._store.get(code);
        expect(stored?.sealedToken).toBeDefined();
        expect(stored?.sealedToken).not.toContain("session-token-value");
    });

    it("is single-use: a second redemption of the same code fails", async () => {
        const code = await DbCliHandoff.create("session-token-value", "user-1");

        await expect(DbCliHandoff.redeem(code)).resolves.toBe(
            "session-token-value",
        );
        await expect(DbCliHandoff.redeem(code)).rejects.toThrow();
    });

    it("deletes the code on redemption -- it is gone from storage after use", async () => {
        const code = await DbCliHandoff.create("session-token-value", "user-1");
        expect(controller._store.has(code)).toBe(true);

        await DbCliHandoff.redeem(code);

        expect(controller._store.has(code)).toBe(false);
    });

    it("rejects an unknown code", async () => {
        await expect(DbCliHandoff.redeem("never-issued-code")).rejects.toThrow();
    });

    it("rejects an expired code even though it is still in storage", async () => {
        const code = await DbCliHandoff.create("session-token-value", "user-1");
        // Back-date the stored document past the TTL without waiting for it.
        const stored = controller._store.get(code)!;
        stored.createdAt = new Date(Date.now() - 10 * 60 * 1000);

        await expect(DbCliHandoff.redeem(code)).rejects.toThrow();
        // Expiry is still enforced via findOneAndDelete, so the (expired)
        // code is consumed on the failed attempt too -- it cannot be retried.
        expect(controller._store.has(code)).toBe(false);
    });
});
