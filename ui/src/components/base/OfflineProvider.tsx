"use client";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

import { Event, EventId } from "@/components/schedule/types/event";
import { deepCopyEvent } from "@/components/schedule/types/EventUtils";

export type OfflineContextState = {
    default: boolean;
    offlineMode: boolean;
    setOfflineMode: Dispatch<SetStateAction<boolean>>;
    pushDialogOpen: boolean;
    setPushDialogOpen: Dispatch<SetStateAction<boolean>>;
    captureEventBeforeEdit: (event: Event) => void;
    captureInitialEvents: (events: Array<Event>) => void;
    purgeCapturedState: () => void;
    purgeCapturedEvents: (eventIds: Array<EventId>) => void;
    getCapturedEvent: (eventId: EventId) => Event | null;
    getCapturedState: () => Record<EventId, Event>;
};

const OfflineContext = createContext<OfflineContextState | undefined>({
    default: true,
    offlineMode: false,
    setOfflineMode: () => {},
    pushDialogOpen: false,
    setPushDialogOpen: () => {},
    captureEventBeforeEdit: (_event) => {},
    captureInitialEvents: (_events) => {},
    purgeCapturedState: () => {},
    purgeCapturedEvents: (_eventIds) => {},
    getCapturedEvent: (_eventId) => null,
    getCapturedState: () => ({}),
});

export const OfflineProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [capturedStateBeforeOffline, setCapturedStateBeforeOffline] =
        useState<Record<EventId, Event>>({});
    const [offlineMode, setOfflineMode] = useState<boolean>(false);
    const [pushDialogOpen, setPushDialogOpen] = useState<boolean>(false);

    const setOfflineModeWrapper = useCallback<
        Dispatch<SetStateAction<boolean>>
    >(
        (value) => {
            setOfflineMode((prev) => {
                const next = typeof value === "function" ? value(prev) : value;

                // Trigger the diff reconciliation dialog when exiting offline mode
                if (prev === true && next === false) {
                    setPushDialogOpen(true);
                }

                return next;
            });
        },
        [setPushDialogOpen],
    );

    const captureEventBeforeEdit = useCallback((event: Event) => {
        setCapturedStateBeforeOffline((capturedState) => {
            if (event.id in capturedState) {
                // Keep the oldest version (first seen at the time of session entry or pre-edit)
                return capturedState;
            }

            return {
                ...capturedState,
                [event.id]: deepCopyEvent(event),
            };
        });
    }, []);

    const captureInitialEvents = useCallback((events: Array<Event>) => {
        setCapturedStateBeforeOffline((capturedState) => {
            let changed = false;
            const nextState = { ...capturedState };
            for (const event of events) {
                if (!(event.id in nextState)) {
                    nextState[event.id] = deepCopyEvent(event);
                    changed = true;
                }
            }
            return changed ? nextState : capturedState;
        });
    }, []);

    const purgeCapturedState = useCallback(() => {
        setCapturedStateBeforeOffline({});
    }, []);

    // Drop only the given events from the captured pre-offline snapshot. Used
    // after a partial push (#157) so items that already synced don't reappear
    // as pending edits on the next reconciliation pass, while failed items keep
    // their captured version for retry.
    const purgeCapturedEvents = useCallback((eventIds: Array<EventId>) => {
        setCapturedStateBeforeOffline((capturedState) => {
            let changed = false;
            const next = { ...capturedState };
            for (const id of eventIds) {
                if (id in next) {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : capturedState;
        });
    }, []);

    const getCapturedEvent = useCallback(
        (eventId: EventId): Event | null => {
            return capturedStateBeforeOffline[eventId] ?? null;
        },
        [capturedStateBeforeOffline],
    );

    const getCapturedState = useCallback((): Record<EventId, Event> => {
        return capturedStateBeforeOffline;
    }, [capturedStateBeforeOffline]);

    // Memoized: a fresh object here re-renders every consumer of this
    // context on each render of the provider, app-wide.
    const offlineValue = useMemo(
        () => ({
            default: false,
            offlineMode,
            setOfflineMode: setOfflineModeWrapper,
            pushDialogOpen,
            setPushDialogOpen,
            captureEventBeforeEdit,
            captureInitialEvents,
            purgeCapturedState,
            purgeCapturedEvents,
            getCapturedEvent,
            getCapturedState,
        }),
        [
            offlineMode,
            setOfflineModeWrapper,
            pushDialogOpen,
            setPushDialogOpen,
            captureEventBeforeEdit,
            captureInitialEvents,
            purgeCapturedState,
            purgeCapturedEvents,
            getCapturedEvent,
            getCapturedState,
        ],
    );

    return (
        <OfflineContext.Provider
            value={offlineValue}
        >
            {children}
        </OfflineContext.Provider>
    );
};

export const useOffline = () => {
    const context = useContext(OfflineContext);

    if (context === undefined || context.default) {
        throw new Error("useOffline must be used within an OfflineProvider");
    }

    return context;
};
