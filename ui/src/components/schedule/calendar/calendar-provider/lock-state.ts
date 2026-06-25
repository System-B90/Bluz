import { EventLockMessage } from "@/api-shared/types";
import { EventId } from "@/components/schedule/types/event";

/**
 * Period-locking presence protocol (issue #12).
 *
 * Locks are ephemeral presence, not persisted state, so they are relayed
 * peer-to-peer through the session server. Because a broadcast channel has no
 * memory, two problems must be solved without a database:
 *
 *  1. A client that crashes or loses its connection never sends EVENT_UNLOCK,
 *     which would otherwise leave a permanent stale lock on every other client.
 *  2. A client that joins (or reconnects) after a lock was taken never saw the
 *     original EVENT_LOCK and would be unaware of it.
 *
 * Both are solved with a self-healing heartbeat + TTL scheme: lock holders
 * re-emit their lock on an interval shorter than the TTL, receivers refresh the
 * expiry on every echo, and a sweeper prunes locks whose expiry has lapsed.
 * Late joiners learn about a lock within one heartbeat; crashed holders' locks
 * disappear within one TTL.
 *
 * The functions here are pure so the timing-sensitive logic is unit-testable
 * without a DOM or fake timers.
 */

/** How often a lock holder re-broadcasts its lock while a dialog is open. */
export const LOCK_HEARTBEAT_MS = 10_000;

/**
 * How long a received lock survives without a refreshing heartbeat. Set to a
 * multiple of the heartbeat so a single dropped message never expires a lock
 * that is still genuinely held.
 */
export const LOCK_TTL_MS = 30_000;

/** How often expired locks are swept from local state. */
export const LOCK_SWEEP_MS = 5_000;

/** A received lock paired with the local clock time at which it expires. */
export type TrackedLock = {
    lock: EventLockMessage;
    expiresAt: number;
};

/** Internal lock state: event id → tracked lock. */
export type LockState = Record<EventId, TrackedLock>;

type ApplyLockOptions = {
    /** The current user's id, used to drop our own lock echoes. */
    selfId: string;
    /** Current epoch time in ms (injected for testability). */
    now: number;
    /** Lock lifetime in ms. Defaults to {@link LOCK_TTL_MS}. */
    ttlMs?: number;
};

/**
 * Apply a single lock or unlock update to the lock state.
 *
 * @param state The current lock state.
 * @param eventId The event the update concerns.
 * @param lock The incoming lock, or `null` to release the lock.
 * @param options Self id (for echo filtering), current time, and TTL.
 * @returns A new state object, or the same reference when nothing changed.
 */
export function applyLockUpdate(
    state: LockState,
    eventId: EventId,
    lock: EventLockMessage | null,
    { selfId, now, ttlMs = LOCK_TTL_MS }: ApplyLockOptions,
): LockState {
    // Ignore our own lock echoes — we already know what we are editing.
    if (lock !== null && lock.lockedById === selfId) {
        return state;
    }

    if (lock === null) {
        if (!(eventId in state)) {
            return state;
        }
        const next = { ...state };
        delete next[eventId];
        return next;
    }

    return {
        ...state,
        [eventId]: { lock, expiresAt: now + ttlMs },
    };
}

/**
 * Remove every lock whose expiry has passed.
 *
 * @param state The current lock state.
 * @param now Current epoch time in ms.
 * @returns A new state object, or the same reference when nothing expired.
 */
export function pruneExpiredLocks(state: LockState, now: number): LockState {
    let changed = false;
    const next: LockState = {};

    for (const [eventId, tracked] of Object.entries(state)) {
        if (tracked.expiresAt > now) {
            next[eventId] = tracked;
        } else {
            changed = true;
        }
    }

    return changed ? next : state;
}

/**
 * Project the internal lock state down to the public map consumers read,
 * dropping the bookkeeping expiry timestamps.
 *
 * @param state The current lock state.
 * @returns A map of event id → lock message.
 */
export function toPublicLocks(
    state: LockState,
): Record<EventId, EventLockMessage> {
    const out: Record<EventId, EventLockMessage> = {};
    for (const [eventId, tracked] of Object.entries(state)) {
        out[eventId] = tracked.lock;
    }
    return out;
}
