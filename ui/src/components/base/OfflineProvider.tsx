"use client";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
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
    markEventCreatedLocally: (eventId: EventId) => void;
    isEventCreatedLocally: (eventId: EventId) => boolean;
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
    markEventCreatedLocally: (_eventId) => {},
    isEventCreatedLocally: (_eventId) => false,
});

export const OfflineProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [capturedStateBeforeOffline, setCapturedStateBeforeOffline] =
        useState<Record<EventId, Event>>({});
    // Explicit tag for events created while offline, so reconciliation can
    // tell "created locally" apart from "modified locally" without guessing
    // from id shape (a UUID heuristic misfires for hyphenated server ids).
    const [locallyCreatedEventIds, setLocallyCreatedEventIds] = useState<
        Set<EventId>
    >(new Set());
    const [offlineMode, setOfflineMode] = useState<boolean>(false);
    const [pushDialogOpen, setPushDialogOpen] = useState<boolean>(false);
    // React (StrictMode in particular) can invoke a state updater more than
    // once per commit; setPushDialogOpen used to live inside the
    // setOfflineMode updater, which is meant to be a pure function of `prev`
    // and got double-invoked as a result. Track the previous value in a ref
    // instead and decide whether to open the dialog after the update settles.
    const prevOfflineModeRef = useRef(offlineMode);

    const setOfflineModeWrapper = useCallback<
        Dispatch<SetStateAction<boolean>>
    >((value) => {
        setOfflineMode((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            return next;
        });
    }, []);

    useEffect(() => {
        // Trigger the diff reconciliation dialog when exiting offline mode.
        if (prevOfflineModeRef.current === true && offlineMode === false) {
            setPushDialogOpen(true);
        }
        prevOfflineModeRef.current = offlineMode;
    }, [offlineMode]);

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
        setLocallyCreatedEventIds(new Set());
    }, []);

    const markEventCreatedLocally = useCallback((eventId: EventId) => {
        setLocallyCreatedEventIds((prev) => {
            if (prev.has(eventId)) return prev;
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
    }, []);

    const isEventCreatedLocally = useCallback(
        (eventId: EventId): boolean => locallyCreatedEventIds.has(eventId),
        [locallyCreatedEventIds],
    );

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
        setLocallyCreatedEventIds((prev) => {
            let changed = false;
            const next = new Set(prev);
            for (const id of eventIds) {
                if (next.delete(id)) changed = true;
            }
            return changed ? next : prev;
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
            markEventCreatedLocally,
            isEventCreatedLocally,
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
            markEventCreatedLocally,
            isEventCreatedLocally,
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
