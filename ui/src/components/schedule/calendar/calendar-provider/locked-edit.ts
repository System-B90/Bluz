import { EventLockMessage } from "@/api-shared/types";
import { EventId } from "@/components/schedule/types/event";

/**
 * Quick edits (drag, split, right-click menu) skip the event dialog and with
 * it the dialog's "being edited by" banner, so an edit to an event another
 * user has open needs its own loud confirmation (#775).
 */

/**
 * Display names of the other users currently editing any of the events,
 * de-duplicated in first-seen order.
 * @param eventIds The events about to be edited.
 * @param eventLocks Live locks held by *other* users (own locks are never tracked).
 */
export function lockHoldersOf(
    eventIds: Iterable<EventId>,
    eventLocks: Record<EventId, EventLockMessage | undefined>,
): Array<string> {
    const names = new Set<string>();
    for (const id of eventIds) {
        const lock = eventLocks[id];
        if (lock) names.add(lock.lockedByName || "משתמש אחר");
    }
    return [ ...names ];
}

export const LOCKED_EDIT_TITLE = "המופע נערך כרגע";
export const LOCKED_EDIT_CONFIRM_LABEL = "לערוך בכל זאת";

/**
 * The confirmation body for editing events someone else has open.
 * @param holders Names from {@link lockHoldersOf}; must be non-empty.
 * @param eventCount How many events the edit touches.
 */
export function lockedEditMessage(holders: Array<string>, eventCount: number): string {
    const who = holders.join(", ");
    const what = eventCount > 1 ? "חלק מהמופעים שנבחרו נערכים" : "המופע נערך";
    return `${what} כרגע על ידי ${who}. `
        + `עריכה עכשיו עלולה לגרום להתנהגות לא צפויה כש${holders.length > 1 ? "הם ישמרו" : `${who} ישמור`} את השינויים. `
        + "להמשיך בכל זאת?";
}
