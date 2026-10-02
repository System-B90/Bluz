"use client";
import { useCallback } from "react";

import { EventLockMessage } from "@/api-shared/types";
import {
    LOCKED_EDIT_CONFIRM_LABEL,
    LOCKED_EDIT_TITLE,
    lockedEditMessage,
    lockHoldersOf,
} from "@/components/schedule/calendar/calendar-provider/locked-edit";
import { EventId } from "@/components/schedule/types/event";

type Confirm = (
    message: string,
    options?: { title?: string; confirmLabel?: string },
) => Promise<boolean>;

/**
 * Quick edits (drag, split, right-click menu) skip the event dialog and its
 * "being edited by" banner, so they ask loudly before touching an event
 * someone else has open (#775).
 * @param eventLocks Live locks held by other users.
 * @param confirm The calendar's confirm dialog.
 */
export function useLockedEditGuard(
    eventLocks: Record<EventId, EventLockMessage | undefined>,
    confirm: Confirm,
) {
    /** Resolves true at once when none of the events is locked. */
    const confirmLockedEdit = useCallback(
        async (eventIds: Array<EventId>): Promise<boolean> => {
            const holders = lockHoldersOf(eventIds, eventLocks);
            if (holders.length === 0) return true;
            return await confirm(lockedEditMessage(holders, eventIds.length), {
                title: LOCKED_EDIT_TITLE,
                confirmLabel: LOCKED_EDIT_CONFIRM_LABEL,
            });
        },
        [eventLocks, confirm],
    );

    /**
     * Wraps a quick-edit handler so it runs only after the lock check.
     * @param run The handler to guard.
     * @param idsOf The events a call touches; null skips the check.
     */
    const withLockGuard = useCallback(
        <Args extends Array<unknown>>(
            run: (...args: Args) => void,
            idsOf: (...args: Args) => Array<EventId> | null,
        ) =>
            (...args: Args): void => {
                const ids = idsOf(...args);
                if (!ids) return run(...args);
                void confirmLockedEdit(ids).then((ok) => {
                    if (ok) run(...args);
                });
            },
        [confirmLockedEdit],
    );

    return { confirmLockedEdit, withLockGuard };
}
