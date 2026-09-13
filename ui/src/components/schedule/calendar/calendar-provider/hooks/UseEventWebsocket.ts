import { useCallback, useEffect } from "react";

import { eventDateFixupToDayjs } from "@/api-shared/calendar";
import {
    EventAddedOrRemovedMessage,
    EventDataUpdateMessage,
    EventLockMessage,
    EventUnlockMessage,
} from "@/api-shared/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event, EventId } from "@/components/schedule/types/event";
import { iterationSyncId, MessageTypes } from "@/settings";

export const useEventWebsocket = (
    offlineMode: boolean,
    dispatch: (action: CalendarAction) => void,
    setEventLock: (eventId: EventId, lock: EventLockMessage | null) => void,
    activeIterationId?: string,
    currentIterationId?: string,
) => {
    const { addMessageHandler, registerSyncObject, deregisterSyncObject } =
        useAuth();

    /*
     * "Am I looking at the current run?" — and the answer has to be yes both
     * when nothing is scoped *and* when the scoped id happens to be the
     * current iteration's own id.
     *
     * The server has one representation for a current-run write: it omits the
     * iteration entirely, broadcasting with `iterationId: undefined` to
     * `CURRENT_ITERATION_SYNC_ID`. The client has another: `IterationProvider`
     * backfills `?it=` with the current iteration's real id, so
     * `activeIterationId` is that id, not `undefined`. Comparing the two
     * directly makes every current-run broadcast look like it belongs to some
     * other iteration.
     *
     * That is not hypothetical: installs migrated from before the iteration
     * registry have a current iteration whose literal id is "current"
     * (db-iterations.ts), which made the subscription id collide with
     * `CURRENT_ITERATION_SYNC_ID` by pure coincidence — frames arrived, and
     * were then dropped by the match below. On any install whose current
     * iteration has an ordinary id, the subscription missed too and nothing
     * arrived at all. Either way the calendar silently stopped updating for
     * every user on the default view until a reload (#582).
     *
     * `isReadOnlyIteration` in IterationProvider already makes exactly this
     * distinction, for exactly this reason (#456).
     */
    const viewingCurrentRun =
        !activeIterationId || activeIterationId === currentIterationId;

    // Subscribe to the sync object for the iteration being viewed so the
    // server only fans iteration-scoped broadcasts (full event documents) to
    // sockets actually viewing that iteration, instead of every logged-in
    // browser (#525).
    //
    // registerSyncObject records the subscription as desired state and the
    // transport replays it on every reconnect, so this effect does not need to
    // observe socket lifecycle. An earlier version sent the frame through
    // sendMessage instead, which meant the subscription was lost on the first
    // reconnect (and dropped outright if the ticket fetch was still in flight),
    // leaving the calendar silently stale until a page reload.
    useEffect(() => {
        // Two channels can carry traffic for the run being viewed: the
        // shared current-run id most server writes still broadcast to when
        // viewing the current run (see the #582 note above), and the
        // explicit per-iteration id, which lock/unlock always uses (real id,
        // never "undefined means current") so a relay never needs to know
        // whether the run it's relaying for happens to be the current one.
        const syncIds = Array.from(
            new Set(
                viewingCurrentRun
                    ? [iterationSyncId(undefined), iterationSyncId(activeIterationId)]
                    : [iterationSyncId(activeIterationId)],
            ),
        );
        syncIds.forEach(registerSyncObject);
        // Cleanup closes over this run's syncIds, so an iteration switch
        // deregisters the old ones before the next run registers the new
        // ones — React runs the previous cleanup first. No bookkeeping ref
        // needed.
        return () => syncIds.forEach(deregisterSyncObject);
    }, [
        viewingCurrentRun,
        activeIterationId,
        registerSyncObject,
        deregisterSyncObject,
    ]);

    // Ignore broadcasts that belong to an iteration other than the one being
    // viewed. A broadcast without an iterationId is for the current run, which
    // is why "viewing the current run" has to cover the scoped-to-its-own-id
    // case above and not just the unscoped one.
    const isForActiveIteration = useCallback(
        (broadcastIterationId?: string) => {
            if (viewingCurrentRun) {
                // Accept both spellings of "the current run": the unscoped
                // form the server sends for its own writes, and the explicit
                // id that client-relayed frames (locks) carry.
                return (
                    !broadcastIterationId ||
                    broadcastIterationId === currentIterationId
                );
            }
            return broadcastIterationId === activeIterationId;
        },
        [viewingCurrentRun, activeIterationId, currentIterationId],
    );

    // The underlying session-ws package types the handler payload as `any`
    // (it's a generic transport, not aware of Bluz's message shapes), so the
    // `any` has to be swallowed somewhere. Do it once here as `unknown` and
    // narrow per-case below, instead of scattering unchecked `as X` casts
    // across every switch branch.
    const onWebSocketMessage = useCallback(
        (messageType: MessageTypes, data: unknown) => {
            switch (messageType) {
            // Lock/unlock messages are handled even in offline mode so the UI
            // always reflects what other users are editing.
            case MessageTypes.EVENT_LOCK: {
                const msg = data as EventLockMessage;
                if (!isForActiveIteration(msg.iterationId)) break;
                setEventLock(msg.eventId, msg);
                break;
            }
            case MessageTypes.EVENT_UNLOCK: {
                const msg = data as EventUnlockMessage;
                if (!isForActiveIteration(msg.iterationId)) break;
                setEventLock(msg.eventId, null);
                break;
            }
            }

            if (offlineMode) return;

            switch (messageType) {
            case MessageTypes.EVENT_DATA_UPDATE: {
                const msg = data as EventDataUpdateMessage<Event>;
                if (!isForActiveIteration(msg.iterationId)) break;
                const updatedEvents = Object.values(msg.events).map(
                    (ev) => eventDateFixupToDayjs(ev),
                );
                dispatch({ type: "UPSERT_MANY", payload: updatedEvents });
                break;
            }
            case MessageTypes.EVENT_ADDED_OR_REMOVED: {
                const msg = data as EventAddedOrRemovedMessage<Event>;
                if (!isForActiveIteration(msg.iterationId)) break;
                if (msg.action === "removed") {
                    dispatch({
                        type: "DELETE_EVENT",
                        payload: msg.eventId,
                    });
                } else if (msg.action === "added") {
                    dispatch({
                        type: "UPSERT_EVENT",
                        payload: eventDateFixupToDayjs(msg.newData),
                    });
                }
                break;
            }
            }
        },
        [offlineMode, dispatch, setEventLock, isForActiveIteration],
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        return addMessageHandler(onWebSocketMessage);
    }, [addMessageHandler, onWebSocketMessage]);
};
