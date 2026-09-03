import { useCallback, useEffect, useRef } from "react";

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
) => {
    const { addMessageHandler, sendMessage } = useAuth();

    // Subscribe to the sync object for the iteration being viewed so the
    // server only fans iteration-scoped broadcasts (full event documents) to
    // sockets actually viewing that iteration, instead of every logged-in
    // browser (#525). Re-subscribes on reconnect (`sendMessage` queues while
    // connecting) and swaps the subscription when the active iteration
    // changes; deregisters the previous one so subscriptions don't
    // accumulate across a session's iteration switches.
    const subscribedSyncId = useRef<string | null>(null);
    useEffect(() => {
        const syncId = iterationSyncId(activeIterationId);
        if (subscribedSyncId.current && subscribedSyncId.current !== syncId) {
            sendMessage({
                type: MessageTypes.DEREGISTER_SYNC_PROVIDER,
                syncObjectId: subscribedSyncId.current,
            });
        }
        sendMessage({
            type: MessageTypes.REGISTER_SYNC_PROVIDER,
            syncObjectId: syncId,
        });
        subscribedSyncId.current = syncId;
    }, [activeIterationId, sendMessage]);

    // Ignore broadcasts that belong to an iteration other than the one being
    // viewed. A broadcast without an iterationId is for the current run; when
    // viewing the current run (no activeIterationId) we only accept those.
    const isForActiveIteration = useCallback(
        (broadcastIterationId?: string) => {
            if (activeIterationId) {
                return broadcastIterationId === activeIterationId;
            }
            return !broadcastIterationId;
        },
        [activeIterationId],
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
