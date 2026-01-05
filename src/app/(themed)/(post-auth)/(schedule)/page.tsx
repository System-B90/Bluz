'use client';

import { apiDeletePeriod, apiSavePeriod } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar, safeApiFetcher } from '@/api-client/common';
import ScheduleAppBar from '@/components/app-bar';
import BluezCalendar from '@/components/schedule/calendar';
import { useCalendar } from '@/components/schedule/calendar-provider';
import PeriodDialog from '@/components/schedule/event-dialog';
import SettingsDialog from "@/components/schedule/settings-dialog";
import { Period } from "@/components/schedule/types/event";
import { Box } from '@mui/material';
import { useHistoryState } from "@uidotdev/usehooks";
import dayjs from 'dayjs';
import 'dayjs/locale/he';
import { enqueueSnackbar } from 'notistack';
import { SetStateAction, useCallback, useEffect, useState } from 'react';
import { v4 as uuid4 } from 'uuid';

export default function SchedulePage()
{
    const { periods: serverPeriods } = useCalendar();
    const {
        state: periods,
        set: setPeriods,
        undo,
        redo,
    } = useHistoryState<Array<Period>>(serverPeriods);

    const [ selectedPeriod, setSelectedPeriod ] = useState<Partial<Period>>();
    const [ openPeriodDialog, setOpenPeriodDialog ] = useState<boolean>(false);
    const [ openSettingsDialog, setOpenSettingsDialog ] = useState<boolean>(false);
    console.log('selectedPeriod', selectedPeriod);
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

    useEffect(() =>
    {
        setPeriods(serverPeriods);
    }, [ serverPeriods, setPeriods ]);


    const handleSavePeriod = useCallback((period: Partial<Period>): void =>
    {
        if (!period || period.name === '') { return; }

        const newPeriod: Period = {
            id: period.id,
            name: period.name || '',
            subject: parseInt(period.subject?.toString() || '0', 10),
            startTime: period.startTime || dayjs(),
            endTime: period.endTime || dayjs(),
            type: period.type || 'exercise',
            rooms: period.rooms?.map((v) => typeof v === 'string' ? parseInt(v) : v) || [],
            instructors: period.instructors || [],
            tags: period.tags || [],
            notes: period.notes || '',
            locked: period.locked || false,
            required: period.required || false,
            hidden: period.hidden || false,
        } as Period;

        if (newPeriod.id)
        {
            setPeriods([ ...periods.filter(pp => pp.id !== newPeriod.id), newPeriod ]);
        }

        setOpenPeriodDialog(false);

        apiSavePeriod(newPeriod)
            .then((p) =>
            {
                enqueueSnackbar(`המופע "${p.name}" נשמר בהצלחה!`, { variant: 'success' });
                setPeriods([ ...periods.filter(pp => pp.id !== newPeriod.id), p ]);
            })
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'שמירת המופע נכשלה!', error));
    }, [ periods, setPeriods, setOpenPeriodDialog ]);

    const handleClosePeriodDialog = useCallback((): void =>
    {
        setOpenPeriodDialog(false);
        setSelectedPeriod(undefined);
    }, [ setOpenPeriodDialog, setSelectedPeriod ]);

    const onPeriodChange = useCallback((action: SetStateAction<Partial<Period>>) =>
    {
        setSelectedPeriod((prev) =>
        {
            // 1. Resolve the value. If 'action' is a function, call it with the previous state.
            // We fallback to {} if prev is null/undefined to ensure the function receives an object.
            const updates = typeof action === 'function'
                ? (action as (prev: Partial<Period>) => Partial<Period>)(prev || {})
                : action;

            // 2. Apply the merge logic you had originally
            // (If state exists, merge updates; otherwise, just use updates)
            return prev ? { ...prev, ...updates } : (updates as Period);
        });
    }, [ setSelectedPeriod ]);

    const onPeriodDelete = useCallback((periodId: Period[ 'id' ]) =>
    {
        apiDeletePeriod(periodId)
            .then(() => enqueueSnackbar('המופע נמחק בהצלחה.', { variant: 'success' }))
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'מחיקת המופע נכשלה!', error));

        setOpenPeriodDialog(false);
        setSelectedPeriod(undefined);
    }, [ setOpenPeriodDialog, setSelectedPeriod ]);

    return (
        <Box sx={ { p: 0, maxWidth: '100%' } }>
            <ScheduleAppBar setOpenSettingsDialog={ setOpenSettingsDialog } />
            <Box className="calendar-container">
                <BluezCalendar handleSavePeriod={ handleSavePeriod } setOpenPeriodDialog={ setOpenPeriodDialog } setSelectedPeriod={ setSelectedPeriod } periods={ periods } />
            </Box>

            <PeriodDialog
                open={ openPeriodDialog }
                period={ selectedPeriod || {} }
                onClose={ handleClosePeriodDialog }
                onSave={ handleSavePeriod }
                onPeriodChange={ onPeriodChange }
                onDelete={ onPeriodDelete }
            />

            <SettingsDialog open={ openSettingsDialog } onClose={ () => { setOpenSettingsDialog(false); } } />
        </Box>
    );
}
