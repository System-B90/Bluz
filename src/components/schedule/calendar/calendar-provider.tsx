'use client';
import { apiGetEvents } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { eventDateFixup } from '@/api-shared/calendar';
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from '@/api-shared/types';
import { useAuth } from '@/components/auth/auth-provider';
import { CalendarFiltersProvider } from '@/components/base/calendar-filter-provider';
import { Event } from '@/components/schedule/types/event';
import { MessageHandlerType } from '@/components/session-ws';
import { MessageTypes } from '@/settings';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';


export type CalendarContextState = {
    default: boolean;
    events: Array<Event>;
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;
};

const CalendarContext = createContext<CalendarContextState | undefined>({
    default: true,
    events: [],
    setStartDate: () => { },
    setEndDate: () => { },
});

export const CalendarProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ startDate, setStartDate ] = useState<Date>();
    const [ endDate, setEndDate ] = useState<Date>();
    const [ events, setEvents ] = useState<Array<Event>>([]);

    const { addMessageHandler } = useAuth();

    const loadEvents = useCallback((s: Date | undefined, e: Date | undefined) =>
    {
        if (!s || !e) { return; }
        apiGetEvents({ startDate: s, endDate: e })
            .then(setEvents)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת לו\"ז נכשלה.', error));
    }, [ setEvents ]);

    useEffect(() =>
    {
        loadEvents(startDate, endDate);
    }, [ startDate, endDate, loadEvents ]);

    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        switch (messageType)
        {
            case MessageTypes.EVENT_DATA_UPDATE:
                setEvents(ps => ps.map((p) => p.id in (data as EventDataUpdateMessage).events ? { ...p, ...eventDateFixup((data as EventDataUpdateMessage).events[ p.id ]) } : p));
                break;
            case MessageTypes.EVENT_ADDED_OR_REMOVED:
                const eventAddedOrRemovedMessage = (data as EventAddedOrRemovedMessage);
                if (eventAddedOrRemovedMessage.action === 'removed')
                {
                    setEvents(ps => ps.filter(p => p.id !== eventAddedOrRemovedMessage.eventId));
                }
                else if (eventAddedOrRemovedMessage.action === 'added')
                {
                    setEvents(ps => [ ...ps, eventDateFixup(eventAddedOrRemovedMessage.newData) as Event ]);
                }
                break;
        };
    }, [ setEvents ]);

    useEffect(() =>
    {
        if (typeof window === 'undefined') { return; }

        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    return (
        <CalendarFiltersProvider>
            <CalendarContext.Provider value={ {
                default: false,
                events: events,
                setStartDate,
                setEndDate,

            } }>
                { children }
            </CalendarContext.Provider>
        </CalendarFiltersProvider>

    );
};

export const useCalendar = () =>
{
    const context = useContext(CalendarContext);

    if (context === undefined || context.default)
    {
        throw new Error('useCalendar must be used within an CalendarProvider');
    }

    return context;
};
