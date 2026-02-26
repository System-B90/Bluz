'use client';
import moment from 'moment';
import 'moment/locale/he'; // Import Hebrew locale
import { Calendar, CalendarProps, DateRange, momentLocalizer, NavigateAction } from 'react-big-calendar';

// DO NOT SORT IMPORTS - they are ordered for a reason!

import { Dispatch, SetStateAction, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/he';

// Import types
import
{
    SlotInfo,
    View,
    Views
} from "react-big-calendar";

import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";


import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/sass/styles.scss';
// Must be after!
import '@/style/calendar.css';

import { useRooms } from '@/components/base/rooms-provider';
import CALENDAR_MESSAGES from '@/components/calendar-messages';
import { useCalendar } from '@/components/schedule/calendar/calendar-provider';
import BluezEventComponent from '@/components/schedule/event-component/base';
import { Event } from "@/components/schedule/types/event";
import { ResolvableRoom, Room } from "@/components/schedule/types/room";
import CustomWorkWeek from '@/components/schedule/calendar/custom-work-week';
import { getRangeForView } from '@/components/schedule/calendar/utils';

const DnDCalendar = withDragAndDrop<Event, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale('he');

export const localizer = momentLocalizer(moment);

export default function BluzCalendar({
    handleSaveEvent,
    handleDeleteEvent,
    setOpenEventDialog,
    setSelectedEvent,
    events,
}: {
    handleSaveEvent: (event: Event) => void;
    handleDeleteEvent: (eventId: Event[ 'id' ]) => void;
    setOpenEventDialog: (open: boolean) => void;
    setSelectedEvent: Dispatch<SetStateAction<Partial<Event> | undefined>>;
    events: Array<Event>;
})
{
    const [ currentView, setCurrentView ] = useState<View>(Views.WEEK);
    const { rooms } = useRooms();
    const { setStartDate, setEndDate } = useCalendar();

    // Copy-Paste Tracking States
    const [ activeEvent, setActiveEvent ] = useState<Partial<Event> | null>(null);
    const [ copiedEvent, setCopiedEvent ] = useState<Partial<Event> | null>(null);
    const [ selectedSlotInfo, setSelectedSlotInfo ] = useState<{ start: Date, resourceId?: any; } | null>(null);

    // 2. Create a ref to hold the LATEST values silently
    const copyPasteData = useRef({ activeEvent, copiedEvent, selectedSlotInfo });

    const handleEditEvent = useCallback((event: Event) =>
    {
        setSelectedEvent(event);
        setOpenEventDialog(true);
    }, [ setSelectedEvent, setOpenEventDialog ]);

    const handleSelectEvent = useCallback((event: Event) =>
    {
        setActiveEvent(event);
        setSelectedEvent(event);
        setSelectedSlotInfo(null); // Clear slot selection when an event is clicked
    }, [ setSelectedEvent, setSelectedSlotInfo, setActiveEvent ]);

    const handleEventDrag = useCallback((changes: EventInteractionArgs<Event>): void =>
    {
        if (changes.event.locked) { return; }
        const updates: Partial<Event> = {
            startTime: dayjs(changes.start),
            endTime: dayjs(changes.end),
        };

        if (changes.resourceId !== undefined && changes.resourceId !== null && changes.event.rooms.length <= 1)
        {
            const roomId: ResolvableRoom = JSON.parse(changes.resourceId.toString());
            updates.rooms = [ roomId ];
        }

        const newEvent = { ...changes.event, ...updates };
        handleSaveEvent(newEvent);
    }, [ handleSaveEvent ]);

    const handleSlotSelect = useCallback((slotInfo: SlotInfo): void =>
    {
        // Track single clicks for pasting purposes before we return out
        setSelectedSlotInfo({ start: slotInfo.start, resourceId: slotInfo.resourceId });
        setActiveEvent(null); // Clear active event selection

        if (slotInfo.action === "click") { return; }

        const newEvent: Partial<Event> = {
            startTime: dayjs(slotInfo.start),
            endTime: dayjs(slotInfo.end),
        };

        if (slotInfo.resourceId !== undefined && slotInfo.resourceId !== null)
        {
            const roomId: ResolvableRoom = JSON.parse(slotInfo.resourceId.toString());
            newEvent.rooms = (roomId && roomId instanceof Object && typeof roomId.source !== undefined && typeof roomId.id !== undefined) ? [ roomId ] : [];
        }

        setSelectedEvent(newEvent);
        setOpenEventDialog(true);
    }, [ setSelectedSlotInfo, setActiveEvent, setSelectedEvent, setOpenEventDialog ]);

    const onNavigateHandler: CalendarProps[ 'onNavigate' ] = useCallback((newDate: Date, view: View, _action: NavigateAction) =>
    {
        const { start, end } = getRangeForView(newDate, view);

        setStartDate(start);
        setEndDate(end);
    }, [ setStartDate, setEndDate ]);

    const onRangeChangeHandler: CalendarProps[ 'onRangeChange' ] = useCallback(
        (range: Date[] | DateRange) =>
        {
            if (Array.isArray(range))
            {
                setStartDate(range[ 0 ]);
                setEndDate(range[ range.length - 1 ]);
            } else
            {
                setStartDate(range.start);
                setEndDate(range.end);
            }
        },
        [ setStartDate, setEndDate ]
    );

    useEffect(() =>
    {
        const today = new Date();
        const range = getRangeForView(today, currentView);
        setStartDate(range.start);
        setEndDate(range.end);
    }, [ currentView, setStartDate, setEndDate, ]);

    useEffect(() =>
    {
        copyPasteData.current = { activeEvent, copiedEvent, selectedSlotInfo };
    }, [ activeEvent, copiedEvent, selectedSlotInfo ]);

    const handleKeyDown = useCallback((e: KeyboardEvent) =>
    {

        // console.log(e);
        if ([ 'INPUT', 'TEXTAREA' ].includes((e.target as HTMLElement).tagName)) { return; }

        const { activeEvent, copiedEvent, selectedSlotInfo } = copyPasteData.current;

        if (e.key === 'Delete')
        {
            if (!activeEvent?.id)
            {
                return;
            }
            handleDeleteEvent(activeEvent.id);
            return;
        }

        // Pull the freshest data from the ref
        const isCmdOrCtrl = e.ctrlKey || e.metaKey;

        // COPY (Ctrl+C)
        if (isCmdOrCtrl && e.key === 'c' && activeEvent)
        {
            setCopiedEvent(activeEvent);
        }

        // PASTE (Ctrl+V)
        if (isCmdOrCtrl && e.key === 'v' && copiedEvent)
        {
            e.preventDefault();

            const originalStart = dayjs(copiedEvent.startTime);
            const originalEnd = dayjs(copiedEvent.endTime);
            const durationMinutes = originalEnd.diff(originalStart, 'minute');

            let newStart: dayjs.Dayjs;
            let newEnd: dayjs.Dayjs;
            let newRooms = copiedEvent.rooms;

            if (selectedSlotInfo)
            {
                newStart = dayjs(selectedSlotInfo.start);
                newEnd = newStart.add(durationMinutes, 'minute');

                if (selectedSlotInfo.resourceId !== undefined && selectedSlotInfo.resourceId !== null)
                {
                    newRooms = [ JSON.parse(selectedSlotInfo.resourceId.toString()) ];
                }
            } else
            {
                newStart = originalStart.add(30, 'minute');
                newEnd = originalEnd.add(30, 'minute');
            }

            const { id, ...restCopied } = copiedEvent as any;

            const newEvent = {
                ...restCopied,
                startTime: newStart.toDate(), // Make sure these are strictly Date objects
                endTime: newEnd.toDate(),
                rooms: newRooms,
            } as Event;

            handleSaveEvent(newEvent);

            // Update state to focus on the newly pasted event
            setActiveEvent(newEvent);
            setSelectedSlotInfo(null);
        }
    }, [ handleSaveEvent ]);

    useEffect(() =>
    {
        window.addEventListener('keydown', handleKeyDown);

        return () =>
        {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [ handleKeyDown ]);

    return (
        <DnDCalendar
            className='relative grow'
            style={ { height: 'unset' } }
            min={ new Date(2025, 0, 1, 7, 0) }  // 8:00 AM
            max={ new Date(2025, 0, 1, 22, 0) } // 6:00 PM
            step={ 5 }
            timeslots={ 12 }

            rtl={ true }
            // localizer={ dayjsLocalizer(dayjs) }
            localizer={ localizer }
            messages={ CALENDAR_MESSAGES }

            events={ events }

            defaultView={ "week" }
            views={ { day: true, week: true, work_week: CustomWorkWeek } } // restrict to day/week
            onView={ setCurrentView }

            selectable
            onSelectEvent={ handleSelectEvent }
            onSelectSlot={ handleSlotSelect }
            onDoubleClickEvent={ handleEditEvent }

            { ...(currentView === 'day' && {
                resources: rooms,
                resourceIdAccessor: 'id',
                resourceTitleAccessor: 'name',
                resourceAccessor: (event: Event) => event.rooms
            }) }

            onEventResize={ handleEventDrag }
            onEventDrop={ handleEventDrag }
            startAccessor={ (event) => (event.startTime as Dayjs).toDate() }
            endAccessor={ (event) => (event.endTime as Dayjs).toDate() }
            formats={ { timeGutterFormat: 'HH:mm' } }
            components={ { event: BluezEventComponent } }
            onNavigate={ onNavigateHandler }
            resizableAccessor={ (e) => !e.locked }
            draggableAccessor={ (e) => !e.locked }
            // onRangeChange={ onRangeChangeHandler }

            showMultiDayTimes={ false }
            allDayMaxRows={ 0 }
        />
    );
}
