import { useCallback, useEffect } from "react";

import { eventDateFixup } from "@/api-shared/calendar";
import {
    EventAddedOrRemovedMessage,
    EventDataUpdateMessage,
} from "@/api-shared/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { CalendarAction } from "@/components/schedule/calendar/calendar-provider/hooks/UseEventState";
import { Event } from "@/components/schedule/types/event";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export const useEventWebsocket = (
    offlineMode: boolean,
    dispatch: (action: CalendarAction) => void,
) => {
    const { addMessageHandler } = useAuth();

    const onWebSocketMessage: MessageHandlerType = useCallback(
        (messageType: MessageTypes, data: any) => {
            if (offlineMode) return;

            switch (messageType) {
            case MessageTypes.EVENT_DATA_UPDATE: {
                const msg = data as EventDataUpdateMessage<Event>;
                const updatedEvents = Object.values(msg.events).map(
                    (ev) => eventDateFixup(ev) as Event,
                );
                dispatch({ type: "UPSERT_MANY", payload: updatedEvents });
                break;
            }
            case MessageTypes.EVENT_ADDED_OR_REMOVED: {
                const msg = data as EventAddedOrRemovedMessage<Event>;
                if (msg.action === "removed") {
                    dispatch({ type: "DELETE_EVENT", payload: msg.eventId });
                } else if (msg.action === "added") {
                    dispatch({
                        type: "UPSERT_EVENT",
                        payload: eventDateFixup(msg.newData) as Event,
                    });
                }
                break;
            }
            }
        },
        [offlineMode, dispatch],
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        return addMessageHandler(onWebSocketMessage);
    }, [addMessageHandler, onWebSocketMessage]);
};
