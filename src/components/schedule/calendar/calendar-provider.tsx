'use client';

import { apiDeleteEvent, apiGetEvents, apiCreateEvent } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { eventDateFixup } from '@/api-shared/calendar';
import { EventAddedOrRemovedMessage, EventDataUpdateMessage } from '@/api-shared/types';
import { useAuth } from '@/components/auth/auth-provider';
import { CalendarFiltersProvider } from '@/components/base/calendar-filter-provider';
import { useOffline } from '@/components/base/offline-provider';
import { Event, EventId } from '@/components/schedule/types/event';
import { MessageHandlerType } from '@/components/session-ws';
import { MessageTypes } from '@/settings';
import { useHistoryState } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

export type CalendarContextState = {
    // State
    events: Array<Event>;
    startDate: Date | undefined;
    endDate: Date | undefined;

    // Setters
    setStartDate: Dispatch<SetStateAction<Date | undefined>>;
    setEndDate: Dispatch<SetStateAction<Date | undefined>>;

    // Actions
    saveEvent: (event: Partial<Event>) => void;
    deleteEvent: (eventId: EventId) => void;
    undo: () => void;
    redo: () => void;
};

// Removed the 'default' flag hack; it's better to just type the context as potentially undefined
const CalendarContext = createContext<CalendarContextState | undefined>(undefined);

export const CalendarProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const { offlineMode, captureEventBeforeEdit } = useOffline();
    const { addMessageHandler } = useAuth();

    const [ startDate, setStartDate ] = useState<Date>();
    const [ endDate, setEndDate ] = useState<Date>();

    // 1. History State is now the Single Source of Truth for events
    const {
        state: events,
        set: setEvents,
        undo,
        redo,
    } = useHistoryState<Array<Event>>([]);

    const eventsRef = useRef<Array<Event>>(events);
    useEffect(() =>
    {
        eventsRef.current = events;
    }, [ events ]);

    // --- Data Loading ---
    const loadEvents = useCallback((s: Date | undefined, e: Date | undefined) =>
    {
        if (!s || !e) return;

        apiGetEvents({ startDate: s, endDate: e })
            .then((fetchedEvents) =>
            {
                // When loading fresh data from the server, we set it as the new baseline
                setEvents(fetchedEvents);
            })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת לו"ז נכשלה.', error));
    }, [ setEvents ]);

    useEffect(() =>
    {
        loadEvents(startDate, endDate);
    }, [ startDate, endDate, loadEvents ]);

    // --- WebSockets ---
    const onWebSocketMessage: MessageHandlerType = useCallback((messageType: MessageTypes, data: any) =>
    {
        if (offlineMode) return;

        switch (messageType)
        {
            case MessageTypes.EVENT_DATA_UPDATE:
                setEvents(
                    eventsRef.current.map((p) => p.id in (data as EventDataUpdateMessage<Event>).events
                        ? { ...p, ...eventDateFixup((data as EventDataUpdateMessage<Event>).events[ p.id ]) }
                        : p
                    )
                );
                break;
            case MessageTypes.EVENT_ADDED_OR_REMOVED:
                const msg = data as EventAddedOrRemovedMessage<Event>;
                if (msg.action === 'removed')
                {
                    setEvents(eventsRef.current.filter(p => p.id !== msg.eventId));
                } else if (msg.action === 'added')
                {
                    setEvents([ ...eventsRef.current, eventDateFixup(msg.newData) as Event ]);
                }
                break;
        }
    }, [ offlineMode, setEvents ]);

    useEffect(() =>
    {
        if (typeof window === 'undefined') return;
        return addMessageHandler(onWebSocketMessage);
    }, [ addMessageHandler, onWebSocketMessage ]);

    // --- Domain Logic: Saving & Deleting ---
    const saveEvent = useCallback((eventPartial: Partial<Event>) =>
    {
        if (!eventPartial || eventPartial.name === '') return;

        // Ensure all properties exist (mapping logic moved out of UI)
        const newEvent: Event = {
            id: eventPartial.id ?? crypto.randomUUID(),
            name: eventPartial.name ?? '',
            subject: eventPartial.subject ?? 0,
            hiveModule: eventPartial.hiveModule ?? 0,
            startTime: eventPartial.startTime ?? dayjs(),
            endTime: eventPartial.endTime ?? dayjs(),
            type: eventPartial.type ?? 'exercise',
            courses: eventPartial.courses ?? [],
            rooms: eventPartial.rooms ?? [],
            instructors: eventPartial.instructors ?? [],
            lecturers: eventPartial.lecturers ?? [],
            tags: eventPartial.tags ?? [],
            notes: eventPartial.notes ?? '',
            locked: eventPartial.locked ?? false,
            required: eventPartial.required ?? false,
            hidden: eventPartial.hidden ?? false,
            personalTalk: eventPartial.personalTalk ?? false,
        } as Event;

        // Handle Offline Capturing
        if (newEvent.id && offlineMode)
        {
            const oldEvent = events.find((ev) => ev.id === newEvent.id);
            if (oldEvent)
            {
                captureEventBeforeEdit(oldEvent);
            }
        }

        // Optimistic UI Update + History Push
        setEvents([ ...eventsRef.current.filter(pp => pp.id !== newEvent.id), newEvent ]);

        // Fire API if online
        if (!offlineMode)
        {
            apiCreateEvent(newEvent)
                .then((p) =>
                {
                    enqueueSnackbar(`המופע "${p.name}" נשמר בהצלחה!`, { variant: 'success' });
                    // Optional: Update state again with the exact server response to guarantee consistency
                    setEvents([ ...eventsRef.current.filter(pp => pp.id !== p.id), p ]);
                })
                .catch((error) =>
                {
                    enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המופע נכשלה!', error);
                    // If you want true robust optimistic UI, you would trigger an undo() here if the API fails.
                });
        }
    }, [ events, offlineMode, setEvents, captureEventBeforeEdit ]);

    const deleteEvent = useCallback((eventId: EventId) =>
    {
        // Optimistic UI Update + History Push
        setEvents(eventsRef.current.filter(e => e.id !== eventId));

        if (!offlineMode)
        {
            apiDeleteEvent(eventId)
                .then(() => enqueueSnackbar('המופע נמחק בהצלחה.', { variant: 'success' }))
                .catch((error) =>
                {
                    enqueueApiErrorSnackbar(enqueueSnackbar, 'מחיקת המופע נכשלה!', error);
                });
        }
    }, [ offlineMode, setEvents ]);

    return (
        <CalendarFiltersProvider>
            <CalendarContext.Provider
                value={ {
                    events,
                    startDate,
                    endDate,
                    setStartDate,
                    setEndDate,
                    saveEvent,
                    deleteEvent,
                    undo,
                    redo
                } }
            >
                { children }
            </CalendarContext.Provider>
        </CalendarFiltersProvider>
    );
};

export const useCalendar = () =>
{
    const context = useContext(CalendarContext);
    if (context === undefined)
    {
        throw new Error('useCalendar must be used within a CalendarProvider');
    }
    return context;
};