'use client';

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
    Calendar,
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
import BluezCalendar from '@/components/schedule/calendar';


export default function SchedulePage()
{
    const {
        state: periods,
        set: setPeriods,
        undo,
        redo,
    } = useHistoryState<Array<Period>>([]);
    const { theme, setTheme } = useTheme();

    const toggleTheme = () =>
    {
        setTheme(theme === "dark" ? "light" : "dark");
    };
    const [ selectedPeriod, setSelectedPeriod ] = useState<Partial<Period>>();
    const [ openPeriodDialog, setOpenPeriodDialog ] = useState<boolean>(false);
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);

    useEffect(() =>
    {
        const handleKeyDown = (e: KeyboardEvent) =>
        {
            if (e.ctrlKey && e.key === 'z') { undo(); };
            if (e.ctrlKey && e.key === 'y') { redo(); };
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [ undo, redo ]);

    const handleSavePeriod = useCallback((period: Partial<Period>): void =>
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
    }, [ periods, setPeriods, setOpenPeriodDialog ]);


    return (
        <Box sx={ { p: 0, maxWidth: '100%', direction: 'rtl' } }>
            <ScheduleAppBar toggleTheme={ toggleTheme } setOpenSettingsDialog={ setOpenSettingsDialog } />
            {/*<div style={{ height: '100vh', overflowY: 'auto' }}>*/ }
            <Box className="calendar-container">
                <BluezCalendar handleSavePeriod={ handleSavePeriod } setOpenPeriodDialog={ setOpenPeriodDialog } />
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
