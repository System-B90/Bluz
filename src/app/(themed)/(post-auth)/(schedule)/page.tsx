'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { AppBar, Toolbar, IconButton, Typography, Dialog, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FilterListIcon from '@mui/icons-material/FilterList';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/he';

// Import components
import PeriodDialog from '@/components/schedule/event-dialog';
import { useHistoryState } from "@uidotdev/usehooks";

// Import types
import
{
    DEFAULT_ROOMS,
    DEFAULT_SCHEDULE_CONFIG
} from '@/components/schedule/types/types';
import
{
    Calendar, Culture,
    DateLocalizer,
    DateRange,
    dayjsLocalizer,
    SlotInfo,
    stringOrDate,
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
import { ScheduleConfig } from "@/components/schedule/types/config";
import { useThemeToggle } from "@/components/theme/theme-context";
import Index from "@/components/schedule/settings-dialog";
import { useTheme } from "next-themes";


const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

export default function SchedulePage()
{
    const {
        state: periods,
        set: setPeriods,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useHistoryState<Period[]>([]);
    const { theme, setTheme } = useTheme();

    const toggleTheme = () =>
    {
        setTheme(theme === "dark" ? "light" : "dark");
    };
    // const [periods, setPeriods] = useState<Period[]>([]);
    const [ scheduleConfig, setScheduleConfig ] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
    const [ selectedPeriod, setSelectedPeriod ] = useState<Partial<Period>>();
    const [ openPeriodDialog, setOpenPeriodDialog ] = useState<boolean>(false);
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);
    const [ currentView, setCurrentView ] = useState<View>('week');

    const [ openDeleteDialog, setOpenDeleteDialog ] = useState<boolean>(false);

    useEffect(() =>
    {
        const handleKeyDown = (e: KeyboardEvent) =>
        {
            if (e.ctrlKey && e.key === 'z') undo();
            if (e.ctrlKey && e.key === 'y') redo();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ undo, redo ]);

    // const timeFormat = (range: DateRange, culture?: Culture, localizer?: DateLocalizer) =>{
    //     return localizer.format(range.start, 'HH:mm', culture)
    //
    // };
    const handleEditPeriod = (period: Period): void =>
    {
        setSelectedPeriod(period);
        setOpenPeriodDialog(true);
    };


    const handleSavePeriod = (period: Partial<Period>): void =>
    {
        if (!period || period.name === '') return;

        const newPeriod: Period = {
            id: period.id || uuid4(),
            name: period.name || '',
            subject: period.subject || '',
            startTime: period.startTime || dayjs(),
            endTime: period.endTime || dayjs(),
            type: period.type || 'exercise',
            room: period.room || "",
            instructors: period.instructors || [],
            tags: period.tags || [],
            notes: period.notes || '',
            locked: period.locked || false,
            required: period.required || false,
            hidden: period.hidden || false,
        };

        setPeriods([ ...periods.filter(p => p.id !== newPeriod.id), newPeriod ]);
        setOpenPeriodDialog(false);
    };

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
        <Box sx={ { p: 3, maxWidth: '100%', direction: 'rtl' } }>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" sx={ { flexGrow: 1 } }>
                        Schedule
                    </Typography>

                    <IconButton color="inherit" onClick={ () =>
                    {
                    } }>
                        <FilterListIcon />
                    </IconButton>

                    <IconButton color="inherit" onClick={ toggleTheme }>
                        <Brightness4Icon />
                    </IconButton>

                    <IconButton color="inherit" onClick={ () => setOpenSettingsDialog(true) }>
                        <SettingsIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            {/*<div style={{ height: '100vh', overflowY: 'auto' }}>*/ }
            <Box className="calendar-container">
                <DnDCalendar
                    min={ new Date(2025, 0, 1, 7, 0) }  // 8:00 AM
                    max={ new Date(2025, 0, 1, 22, 0) } // 6:00 PM
                    step={ 5 }
                    timeslots={ 12 }
                    localizer={ dayjsLocalizer(dayjs) }
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
                // style={{height: "100hv"}}
                />
            </Box>
            {/*</div>*/ }

            {/* Period Dialog */ }
            <PeriodDialog
                open={ openPeriodDialog }
                period={ selectedPeriod || {} }
                onClose={ () =>
                {
                    setOpenPeriodDialog(false);
                    setSelectedPeriod(undefined);
                } }
                onSave={ handleSavePeriod }
                onPeriodChange={ (updates: Partial<Period>) => setSelectedPeriod({ ...selectedPeriod, ...updates }) }
            />

            <Index open={ openSettingsDialog } onClose={ () => { setOpenSettingsDialog(false); } } />
        </Box>
    );
}
