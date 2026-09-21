import { describe, it, expect } from "vitest";

import { EventLockMessage } from "@/api-shared/types";
import {
    applyLockUpdate,
    LOCK_TTL_MS,
    LockState,
    pruneExpiredLocks,
    toPublicLocks,
} from "@/components/schedule/calendar/calendar-provider/lock-state";

const SELF_ID = "user-self";
const OTHER_ID = "user-other";

function lockFrom(
    eventId: string,
    lockedById: string,
    lockedByName = "Someone",
): EventLockMessage {
    return { eventId, lockedById, lockedByName };
}

describe("applyLockUpdate", () => {
    it("adds an incoming lock from another user with a TTL expiry", () => {
        const now = 1_000;
        const next = applyLockUpdate({}, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now,
        });

        expect(next.e1.lock.lockedById).toBe(OTHER_ID);
        expect(next.e1.expiresAt).toBe(now + LOCK_TTL_MS);
    });

    it("honors a custom ttl", () => {
        const next = applyLockUpdate({}, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 500,
            ttlMs: 100,
        });
        expect(next.e1.expiresAt).toBe(600);
    });

    it("ignores our own lock echo and returns the same reference", () => {
        const state: LockState = {};
        const next = applyLockUpdate(state, "e1", lockFrom("e1", SELF_ID), {
            selfId: SELF_ID,
            now: 1_000,
        });
        expect(next).toBe(state);
    });

    it("refreshes the expiry when the same lock is re-applied (heartbeat)", () => {
        const first = applyLockUpdate({}, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 1_000,
        });
        const second = applyLockUpdate(first, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 5_000,
        });
        expect(second.e1.expiresAt).toBe(5_000 + LOCK_TTL_MS);
    });

    it("removes a lock on unlock (null)", () => {
        const withLock = applyLockUpdate({}, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 1_000,
        });
        const cleared = applyLockUpdate(withLock, "e1", null, {
            selfId: SELF_ID,
            now: 2_000,
        });
        expect(cleared.e1).toBeUndefined();
    });

    it("ignores a stale unlock from a client that no longer holds the lock (#689)", () => {
        // Client A locks, then client B's lock supersedes it in this
        // observer's state (last writer wins, single slot per event).
        const afterA = applyLockUpdate({}, "e1", lockFrom("e1", "user-a"), {
            selfId: SELF_ID,
            now: 1_000,
        });
        const afterB = applyLockUpdate(afterA, "e1", lockFrom("e1", "user-b"), {
            selfId: SELF_ID,
            now: 2_000,
        });
        // A's belated unlock arrives after B has taken over — must not clear
        // B's still-active lock.
        const stillLocked = applyLockUpdate(
            afterB,
            "e1",
            null,
            { selfId: SELF_ID, now: 3_000 },
            "user-a",
        );
        expect(stillLocked.e1.lock.lockedById).toBe("user-b");

        // B's own unlock, once it actually arrives, does clear it.
        const cleared = applyLockUpdate(
            stillLocked,
            "e1",
            null,
            { selfId: SELF_ID, now: 4_000 },
            "user-b",
        );
        expect(cleared.e1).toBeUndefined();
    });

    it("returns the same reference when unlocking an unknown event", () => {
        const state: LockState = {};
        const next = applyLockUpdate(state, "missing", null, {
            selfId: SELF_ID,
            now: 1_000,
        });
        expect(next).toBe(state);
    });

    it("does not mutate the previous state", () => {
        const state: LockState = {};
        applyLockUpdate(state, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 1_000,
        });
        expect(state).toEqual({});
    });
});

describe("pruneExpiredLocks", () => {
    it("removes locks whose expiry has passed", () => {
        const state: LockState = {
            e1: { lock: lockFrom("e1", OTHER_ID), expiresAt: 1_000 },
            e2: { lock: lockFrom("e2", OTHER_ID), expiresAt: 5_000 },
        };
        const pruned = pruneExpiredLocks(state, 2_000);
        expect(pruned.e1).toBeUndefined();
        expect(pruned.e2).toBeDefined();
    });

    it("treats expiry exactly equal to now as expired", () => {
        const state: LockState = {
            e1: { lock: lockFrom("e1", OTHER_ID), expiresAt: 2_000 },
        };
        expect(pruneExpiredLocks(state, 2_000).e1).toBeUndefined();
    });

    it("returns the same reference when nothing expired", () => {
        const state: LockState = {
            e1: { lock: lockFrom("e1", OTHER_ID), expiresAt: 9_000 },
        };
        expect(pruneExpiredLocks(state, 1_000)).toBe(state);
    });

    it("simulates a crashed holder: lock disappears one TTL after the last heartbeat", () => {
        let state = applyLockUpdate({}, "e1", lockFrom("e1", OTHER_ID), {
            selfId: SELF_ID,
            now: 0,
        });
        // Still alive just before TTL.
        state = pruneExpiredLocks(state, LOCK_TTL_MS - 1);
        expect(state.e1).toBeDefined();
        // Holder crashed — no further heartbeat — lock expires past the TTL.
        state = pruneExpiredLocks(state, LOCK_TTL_MS + 1);
        expect(state.e1).toBeUndefined();
    });
});

describe("toPublicLocks", () => {
    it("strips expiry bookkeeping and keeps the lock messages", () => {
        const state: LockState = {
            e1: { lock: lockFrom("e1", OTHER_ID, "Dana"), expiresAt: 9_000 },
        };
        const pub = toPublicLocks(state);
        expect(pub).toEqual({
            e1: { eventId: "e1", lockedById: OTHER_ID, lockedByName: "Dana" },
        });
    });

    it("returns an empty object for empty state", () => {
        expect(toPublicLocks({})).toEqual({});
    });
});
