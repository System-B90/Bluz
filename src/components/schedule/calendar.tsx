import moment from 'moment';
import 'moment/locale/he'; // Import Hebrew locale
import { Calendar, momentLocalizer } from 'react-big-calendar';

// DO NOT SORT IMPORTS - they are ordered for a reason!

import { useState, useCallback, SetStateAction, Dispatch } from 'react';

import dayjs from 'dayjs';
import 'dayjs/locale/he';

// Import components
import { useHistoryState } from "@uidotdev/usehooks";

// Import types
import
{
    DEFAULT_ROOMS
} from '@/components/schedule/types/types';
import
{
    SlotInfo,
    View,
    Views
} from "react-big-calendar";

import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";


import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/sass/styles.scss';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/style/calendar.css';

import { Period } from "@/components/schedule/types/event";
import { Room } from "@/components/schedule/types/room";
import CALENDAR_MESSAGES from '@/components/calendar-messages';
import BluezEventComponent from '@/components/schedule/event-component';


const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale('he');

const localizer = momentLocalizer(moment);

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

    console.log('Periods', periods);

    const handleEditPeriod = useCallback((period: Period) =>
    {
        setSelectedPeriod(period);
        setOpenPeriodDialog(true);
    }, [ setSelectedPeriod, setOpenPeriodDialog ]);

    const handlePeriodDrag = useCallback((changes: EventInteractionArgs<Period>): void =>
    {
        const updates: Partial<Period> = { startTime: dayjs(changes.start), endTime: dayjs(changes.end), room: changes.resourceId?.toString() || '' };
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
            room: slotInfo.resourceId?.toString() || '',
        };

        console.log('newPeriod', newPeriod);
        setSelectedPeriod(newPeriod);
        setOpenPeriodDialog(true);
    }, [ setSelectedPeriod, setOpenPeriodDialog ]);

    return (
        <DnDCalendar
            className="border-border border-rounded-md border-solid border-2 rounded-lg"

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
            views={ [ Views.DAY, Views.WEEK, Views.WORK_WEEK ] } // restrict to day/week
            onView={ setCurrentView }

            selectable
            onSelectEvent={ setSelectedPeriod }
            onSelectSlot={ handleSlotSelect }
            onDoubleClickEvent={ handleEditPeriod }

            { ...(currentView === 'day' && {
                resources: DEFAULT_ROOMS,
                resourceIdAccessor: 'id',
                resourceTitleAccessor: 'name',
                resourceAccessor: (event: Period) => event.room
            }) }

            onEventResize={ handlePeriodDrag }
            onEventDrop={ handlePeriodDrag }
            startAccessor={ (event) => event.startTime.toDate() }
            endAccessor={ (event) => event.endTime.toDate() }
            formats={ { timeGutterFormat: 'HH:mm' } }
            components={ { event: BluezEventComponent } }
        />
    );
}