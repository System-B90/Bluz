"use client";

import { useEffect } from "react";

import { useSessionWebSocketContext } from "@/components/SessionWs";
import { MessageTypes, STUDENT_SYNC_ID } from "@/settings";

/**
 * Keeps the student board live (#656).
 *
 * The socket carries no calendar data to students: the only thing that arrives
 * on `STUDENT_SYNC_ID` is a content-free "something changed" ping, and the
 * board answers it by refetching `/api/student-view/schedule`, where the whole
 * student projection is applied. That keeps every guarantee — the field
 * allow-list, hidden events, the single-day window — server-side, which is the
 * only place it can be enforced.
 *
 * The socket's ticket is scoped `hanich` for a student, so the session server
 * refuses to register it as a session (which would put it on the untargeted
 * broadcast) and refuses every sync object but this one. There is deliberately
 * no per-iteration student channel, so nothing here can reveal that iterations
 * exist.
 *
 * @param onChange Called when the schedule may have changed. Must be stable.
 */
export function useStudentLiveRefresh(onChange: () => void): void {
    const { addMessageHandler, deregisterSyncObject, registerSyncObject } =
        useSessionWebSocketContext();

    // registerSyncObject records the subscription as desired state and the
    // transport replays it on every reconnect, so this does not need to watch
    // the socket lifecycle (#525).
    useEffect(() => {
        registerSyncObject(STUDENT_SYNC_ID);
        return () => deregisterSyncObject(STUDENT_SYNC_ID);
    }, [deregisterSyncObject, registerSyncObject]);

    useEffect(
        () =>
            addMessageHandler((messageType) => {
                if (messageType === MessageTypes.STUDENT_REFRESH) onChange();
            }),
        [addMessageHandler, onChange],
    );
}
