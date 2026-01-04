import moment from 'moment';
import 'moment/locale/he'; // Import Hebrew locale
import { Calendar, momentLocalizer } from 'react-big-calendar';

// DO NOT SORT IMPORTS - they are ordered for a reason!

import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

import dayjs from 'dayjs';
import 'dayjs/locale/he';

// Import components
import PeriodDialog from '@/components/schedule/event-dialog';
import { useHistoryState } from "@uidotdev/usehooks";

// Import types
import
{
    DEFAULT_ROOMS
} from '@/components/schedule/types/types';
import
{
    dayjsLocalizer,
    SlotInfo,
    View,
    Views
} from "react-big-calendar";

import withDragAndDrop, { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import { v4 as uuid4 } from 'uuid';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/sass/styles.scss';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/style/calendar.css';

import { Period } from "@/components/schedule/types/event";
import { Room } from "@/components/schedule/types/room";
import Index from "@/components/schedule/settings-dialog";
import { useTheme } from "next-themes";
import ScheduleAppBar from '@/components/app-bar';


const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale('he');

const localizer = momentLocalizer(moment);

export default function BluezCalendar({
    handleSavePeriod,
    setOpenPeriodDialog,
}: {
    handleSavePeriod: (period: Period) => void;
    setOpenPeriodDialog: (open: boolean) => void;
})
{
    const [ selectedPeriod, setSelectedPeriod ] = useState<Partial<Period>>();
    const [ currentView, setCurrentView ] = useState<View>(Views.WEEK);

    const [ openDeleteDialog, setOpenDeleteDialog ] = useState<boolean>(false);

    const {
        state: periods,
    } = useHistoryState<Array<Period>>([]);

    const handleEditPeriod = useCallback((period: Period) =>
    {
        setSelectedPeriod(period);
        setOpenPeriodDialog(true);
    }, [ setSelectedPeriod, setOpenPeriodDialog ]);

    const handlePeriodDrag = (changes: EventInteractionArgs<Period>): void =>
    {
        console.log(changes);
        console.log(selectedPeriod);
        const updates: Partial<Period> = { startTime: dayjs(changes.start), endTime: dayjs(changes.end), room: changes.resourceId?.toString() || '' };
        const newPeriod = { ...changes.event, ...updates };
        handleSavePeriod(newPeriod);
    };

    const handleSlotSelect = (slotInfo: SlotInfo): void =>
    {
        if (slotInfo.action === "click")
        {
            return;
        }
        const newPeriod: Partial<Period> = {
            startTime: dayjs(slotInfo.start),
            endTime: dayjs(slotInfo.end),
            room: slotInfo.resourceId?.toString() || '',
        };
        setSelectedPeriod(newPeriod);
        setOpenPeriodDialog(true);
    };

    return (
        <DnDCalendar
            min={ new Date(2025, 0, 1, 7, 0) }  // 8:00 AM
            max={ new Date(2025, 0, 1, 22, 0) } // 6:00 PM
            step={ 5 }
            timeslots={ 12 }
            // localizer={ dayjsLocalizer(dayjs) }
            localizer={ localizer }
            className="border-border border-rounded-md border-solid border-2 rounded-lg"
            events={ periods }
            defaultView={ "week" }
            views={ [ Views.DAY, Views.WEEK, Views.WORK_WEEK ] } // restrict to day/week
            // onView={(view: View): void => setCurrentView(view)}
            selectable
            onSelectEvent={ setSelectedPeriod }
            onSelectSlot={ handleSlotSelect }
            onDoubleClickEvent={ (event: Period) =>
            {
                handleEditPeriod(event);
            } }
            { ...(currentView === 'day' && {
                resources: DEFAULT_ROOMS,
                resourceIdAccessor: 'id',
                resourceTitleAccessor: 'name',
                resourceAccessor: (event: Period) => { event.room; }
            }) }
            onEventResize={ handlePeriodDrag }
            onEventDrop={ handlePeriodDrag }
            startAccessor={ (event) => event.startTime.toDate() }
            endAccessor={ (event) => event.endTime.toDate() }
            rtl={ true }
            formats={ {
                timeGutterFormat: 'HH:mm',
                // eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                //     `${localizer.format(start, 'HH:mm', culture)} – ${localizer.format(end, 'HH:mm', culture)}`,
            } }
        />
    );
}