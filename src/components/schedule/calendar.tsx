import moment from 'moment';
import 'moment/locale/he'; // Import Hebrew locale
import { Calendar, CalendarProps, DateRange, momentLocalizer, NavigateAction } from 'react-big-calendar';

// DO NOT SORT IMPORTS - they are ordered for a reason!

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

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

import { useHiveRooms } from '@/components/base/hive-rooms-provider';
import CALENDAR_MESSAGES from '@/components/calendar-messages';
import { useCalendar } from '@/components/schedule/calendar-provider';
import BluezEventComponent from '@/components/schedule/event-component/base';
import { Period } from "@/components/schedule/types/event";
import { Room } from "@/components/schedule/types/room";
import CustomWorkWeek from '@/components/schedule/custom-work-week';

const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale('he');

export const localizer = momentLocalizer(moment);

export default function BluezCalendar({
    handleSavePeriod,
    setOpenPeriodDialog,
    setSelectedPeriod,
    periods,
}: {
    handleSavePeriod: (period: Period) => void;
    setOpenPeriodDialog: (open: boolean) => void;
    setSelectedPeriod: Dispatch<SetStateAction<Partial<Period> | undefined>>;
    periods: Array<Period>;
})
{
    const [ currentView, setCurrentView ] = useState<View>(Views.WEEK);
    const { rooms } = useHiveRooms();
    const { setStartDate, setEndDate } = useCalendar();

    const handleEditPeriod = useCallback((period: Period) =>
    {
        setSelectedPeriod(period);
        setOpenPeriodDialog(true);
    }, [ setSelectedPeriod, setOpenPeriodDialog ]);

    const handlePeriodDrag = useCallback((changes: EventInteractionArgs<Period>): void =>
    {
        if (changes.event.locked) { return; }
        const updates: Partial<Period> = {
            startTime: dayjs(changes.start),
            endTime: dayjs(changes.end),
        };

        if (changes.resourceId !== undefined && changes.resourceId !== null && changes.event.rooms.length <= 1)
        {
            updates.rooms = [ parseInt(changes.resourceId.toString(), 10) ];
        }

        const newPeriod = { ...changes.event, ...updates };
        handleSavePeriod(newPeriod);
    }, [ handleSavePeriod ]);

    const handleSlotSelect = useCallback((slotInfo: SlotInfo): void =>
    {
        console.log(slotInfo);
        if (slotInfo.action === "click") { return; }

        const newPeriod: Partial<Period> = {
            startTime: dayjs(slotInfo.start),
            endTime: dayjs(slotInfo.end),
        };

        if (slotInfo.resourceId !== undefined && slotInfo.resourceId !== null)
        {
            newPeriod.rooms = [ parseInt(slotInfo.resourceId.toString() || '0', 10) ];
        }

        console.log('newPeriod', newPeriod);
        setSelectedPeriod(newPeriod);
        setOpenPeriodDialog(true);
    }, [ setSelectedPeriod, setOpenPeriodDialog ]);

    const getRangeForView = useCallback((newDate: Date, view: string): DateRange =>
    {
        const mDate = moment(newDate);

        let start: Date;
        let end: Date;

        switch (view)
        {
            case 'month':
                start = mDate.clone().startOf('month').toDate();
                end = mDate.clone().endOf('month').toDate();
                break;

            case 'week':
            case 'work_week':
                // moment's startOf('week') respects the locale set in moment.locale()
                start = mDate.clone().startOf('week').toDate();
                end = mDate.clone().endOf('week').toDate();
                break;

            case 'day':
                start = mDate.clone().startOf('day').toDate();
                end = mDate.clone().endOf('day').toDate();
                break;

            case 'agenda':
                // Agenda usually defaults to a 30-day window from the current date
                start = mDate.clone().startOf('day').toDate();
                end = mDate.clone().add(30, 'days').endOf('day').toDate();
                break;

            default:
                start = newDate;
                end = newDate;
        }

        return { start, end };

    }, []);

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

    return (
        <DnDCalendar
            className='relative grow'
            style={ { height: 'unset' } }
            min={ new Date(2025, 0, 1, 7, 0) }  // 8:00 AM
            max={ new Date(2025, 0, 1, 22, 0) } // 6:00 PM
            step={ 5 }
            timeslots={ 12 }

            rtl={ true }
            // localizer={ dayjsLocalizer(dayjs) }
            localizer={ localizer }
            messages={ CALENDAR_MESSAGES }

            events={ periods }

            defaultView={ "week" }
            views={ { day: true, week: true, work_week: CustomWorkWeek } } // restrict to day/week
            onView={ setCurrentView }

            selectable
            onSelectEvent={ setSelectedPeriod }
            onSelectSlot={ handleSlotSelect }
            onDoubleClickEvent={ handleEditPeriod }

            { ...(currentView === 'day' && {
                resources: rooms,
                resourceIdAccessor: 'id',
                resourceTitleAccessor: 'name',
                resourceAccessor: (event: Period) => event.rooms
            }) }

            onEventResize={ handlePeriodDrag }
            onEventDrop={ handlePeriodDrag }
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