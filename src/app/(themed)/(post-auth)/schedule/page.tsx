'use client';

import {useState, useEffect, useCallback} from 'react';
import {Box} from '@mui/material';
import {AppBar, Toolbar, IconButton, Typography, Dialog, Button} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FilterListIcon from '@mui/icons-material/FilterList';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/he';

// Import components
import PeriodDialog from '@/components/schedule/event-dialog';
import {useHistoryState} from "@uidotdev/usehooks";

// Import types
import {
    DEFAULT_SCHEDULE_CONFIG
} from '@/components/schedule/types/types';
import {Calendar, dayjsLocalizer, SlotInfo, stringOrDate, Views} from "react-big-calendar";

import withDragAndDrop, {EventInteractionArgs} from "react-big-calendar/lib/addons/dragAndDrop";

import {v4 as uuid4} from 'uuid';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/sass/styles.scss';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/style/calendar.css'

import {Period} from "@/components/schedule/types/event";
import {Room} from "@/components/schedule/types/room";
import {ScheduleConfig} from "@/components/schedule/types/config";
import {useThemeToggle} from "@/components/theme/theme-context";


const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

export default function SchedulePage() {
    const {
        state: periods,
        set: setPeriods,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useHistoryState<Period[]>([]);
    const toggleTheme = useThemeToggle();
    // const [periods, setPeriods] = useState<Period[]>([]);
    const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
    const [selectedPeriod, setSelectedPeriod] = useState<Partial<Period>>();
    const [openPeriodDialog, setOpenPeriodDialog] = useState<boolean>(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'z') undo();
            if (e.ctrlKey && e.key === 'y') redo();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const handleEditPeriod = (period: Period) => {
        setSelectedPeriod(period)
        setOpenPeriodDialog(true);
    };


    const handleSavePeriod = (period?: Partial<Period>) => {
        if (!period || period?.name === '') return;

        const newPeriod: Period = {
            id: period.id || uuid4(),
            name: period.name || '',
            subject: period.subject || '',
            startTime: period.startTime || dayjs(),
            endTime: period.endTime || dayjs(),
            type: period.type || 'exercise',
            location: period.location || '',
            instructors: period.instructors || [],
            notes: period.notes || '',
            locked: period.locked || false,
            required: period.required || false,
        };

        setPeriods([...periods.filter(p => p.id !== newPeriod.id), newPeriod]);
        setOpenPeriodDialog(false);
    };

    const handlePeriodDrag = (changes: EventInteractionArgs<Period>): void => {
        console.log(changes);
        console.log(selectedPeriod);
        const updates: Partial<Period> = {startTime: dayjs(changes.start), endTime: dayjs(changes.end)};
        const newPeriod = {...changes.event, ...updates};
        handleSavePeriod(newPeriod);
    }


    const handleSlotSelect = (slotInfo: {
        start: stringOrDate;
        end: stringOrDate;
        slots: Date[] | string[];
        action: 'select' | 'click' | 'doubleClick';
    }): void => {
        console.log("Selected slot");
        // if (slotInfo.action == "doubleClick") {
        const newPeriod: Partial<Period> = {
            startTime: dayjs(slotInfo.start),
            endTime: dayjs(slotInfo.end),
        };
        setSelectedPeriod(newPeriod);
        setOpenPeriodDialog(true);
        // }
    };

    // const currentWeek = schedules.find(w => w.weekNumber === selectedWeek);
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="he">
            <Box sx={{p: 3, maxWidth: '100%', direction: 'rtl'}}>
                <AppBar position="static">
                    <Toolbar>
                        <Typography variant="h6" sx={{flexGrow: 1}}>
                            Schedule
                        </Typography>

                        <IconButton color="inherit" onClick={() => {
                        }}>
                            <FilterListIcon/>
                        </IconButton>

                        <IconButton color="inherit" onClick={toggleTheme}>
                            <Brightness4Icon/>
                        </IconButton>

                        <IconButton color="inherit" onClick={() => {}}>
                            <SettingsIcon/>
                        </IconButton>
                    </Toolbar>
                </AppBar>
                <div>
                    <DnDCalendar
                        localizer={dayjsLocalizer(dayjs)}
                        events={periods}
                        defaultView={"week"}
                        views={[Views.DAY, Views.WEEK]} // restrict to day/week
                        selectable
                        onSelectEvent={setSelectedPeriod}
                        onSelectSlot={handleSlotSelect}
                        onDoubleClickEvent={(event: Period) => {
                            handleEditPeriod(event)
                        }}
                        onEventResize={handlePeriodDrag}
                        onEventDrop={handlePeriodDrag}
                        startAccessor={(event) => event.startTime.toDate()}
                        endAccessor={(event) => event.endTime.toDate()}
                        rtl={true}
                        style={{height: "100%"}}
                    />
                </div>

                {/* Period Dialog */}
                <PeriodDialog
                    open={openPeriodDialog}
                    period={selectedPeriod}
                    onClose={() => {
                        setOpenPeriodDialog(false);
                        setSelectedPeriod(undefined)
                    }}
                    onSave={handleSavePeriod}
                    onPeriodChange={(updates) => setSelectedPeriod({...selectedPeriod, ...updates})}
                />

                {/* Delete Dialog */}
                {/*<DeleteDialog*/}
                {/*  open={openDeleteDialog}*/}
                {/*  period={selectedPeriod}*/}
                {/*  onClose={() => {setOpenDeleteDialog(false); setSelectedPeriod(undefined)}}*/}
                {/*  onConfirm={handleConfirmDelete}*/}
                {/*/>*/}
            </Box>
        </LocalizationProvider>
    );
}
