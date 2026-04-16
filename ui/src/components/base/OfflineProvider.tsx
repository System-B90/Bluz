'use client';
import
    {
        createContext,
        Dispatch,
        SetStateAction,
        useCallback,
        useContext,
        useState,
    } from 'react';

import { Event, EventId } from '@/components/schedule/types/event';
import { deepCopyEvent } from '@/components/schedule/types/EventUtils';

export type OfflineContextState = {
    default: boolean;
    offlineMode: boolean;
    setOfflineMode: Dispatch<SetStateAction<boolean>>;
    pushDialogOpen: boolean;
    captureEventBeforeEdit: (event: Event) => void;
    purgeCapturedState: () => void;
    getCapturedEvent: (eventId: EventId) => Event | null;
};

const OfflineContext = createContext<OfflineContextState | undefined>({
    default: true,
    offlineMode: false,
    setOfflineMode: () => { },
    pushDialogOpen: false,
    captureEventBeforeEdit: (_event) => { },
    purgeCapturedState: () => { },
    getCapturedEvent: (_eventId) => null,
});

export const OfflineProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ capturedStateBeforeOffline, setCapturedStateBeforeOffline ] = useState<Record<EventId, Event>>({});
    const [ offlineMode, setOfflineMode ] = useState<boolean>(false);
    const [ pushDialogOpen, setPushDialogOpen ] = useState<boolean>(false);

    const setOfflineModeWrapper = useCallback<Dispatch<SetStateAction<boolean>>>((value) =>
    {
        setOfflineMode((prev) =>
        {
            const next = typeof value === "function" ? value(prev) : value;

            // If previous value was true
            if (prev === true)
            {
                setPushDialogOpen(true);
            }

            return next;
        });
    }, [ setPushDialogOpen ]);

    const captureEventBeforeEdit = useCallback((event: Event) =>
    {
        console.log('Capturing event', event);
        setCapturedStateBeforeOffline(capturedState =>
        {
            if (event.id in capturedState)
            {
                // Use the older version.
                return capturedState;
            }

            capturedState[ event.id ] = deepCopyEvent(event);
            return capturedState;
        });
    }, []);

    const purgeCapturedState = useCallback(() =>
    {
        setCapturedStateBeforeOffline({});
    }, []);

    const getCapturedEvent = useCallback((eventId: EventId): Event | null =>
    {
        return capturedStateBeforeOffline[ eventId ] ?? null;
    }, [ capturedStateBeforeOffline ]);

    return (
        <OfflineContext.Provider value={ {
            default: false,
            offlineMode,
            setOfflineMode: setOfflineModeWrapper,
            pushDialogOpen,
            captureEventBeforeEdit,
            purgeCapturedState,
            getCapturedEvent,
        } }>
            { children }
        </OfflineContext.Provider>
    );
};

export const useOffline = () =>
{
    const context = useContext(OfflineContext);

    if (context === undefined || context.default)
    {
        throw new Error('useOffline must be used within an OfflineProvider');
    }

    return context;
};
