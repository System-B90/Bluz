/**
 * Name: WorkTimePanel.tsx
 * Purpose: Management interface for curriculum work weeks and daily hour allocations.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import { OverviewTab } from '@/components/gant/curriculum-view/WorkTimePanel/OverviewTab';
import { WorkTimePanelProps } from '@/components/gant/curriculum-view/WorkTimePanel/types';
import { useWorkTimePanelLogic } from '@/components/gant/curriculum-view/WorkTimePanel/useWorkTimePanelLogic';
import { cloneWeeks, pickNextDay } from '@/components/gant/curriculum-view/WorkTimePanel/utils';
import { WeekAccordion } from '@/components/gant/curriculum-view/WorkTimePanel/WeekAccordion';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import { Box, Card, CircularProgress, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { KeyboardEvent, useCallback, useMemo, useState } from 'react';

export function WorkTimePanel({ curriculumId, curriculum }: WorkTimePanelProps)
{
    // 1. Single source of truth: reset state by changing the 'key' at the parent level or 
    // simply initializing with curriculum data. No useEffect(setLocalWeeks).
    const [ localWeeks, setLocalWeeks ] = useState(() => cloneWeeks(curriculum?.weeks ?? []));
    const [ selectedTab, setSelectedTab ] = useState(0);

    const canEdit = Boolean(curriculumId);
    const curriculumWeeks = curriculum?.weeks ?? [];
    const logic = useWorkTimePanelLogic(curriculumId, curriculumWeeks, localWeeks, setLocalWeeks);

    // --- Memoized Callbacks (SOLID: Single Responsibility) ---

    const handleTabChange = useCallback((_: unknown, value: number) =>
    {
        setSelectedTab(value);
    }, []);

    const addWeek = useCallback(async () =>
    {
        const nextNumber = (localWeeks[ localWeeks.length - 1 ]?.number ?? 0) + 1;
        const updatedWeeks = [
            ...cloneWeeks(localWeeks),
            { number: nextNumber, comment: '', days: logic.buildDefaultWeekDays() }
        ];
        await logic.persistWeeks(updatedWeeks);
        setSelectedTab(updatedWeeks.length);
    }, [ localWeeks, logic ]);

    const addDay = useCallback(async (weekIndex: number) =>
    {
        const targetWeek = localWeeks[ weekIndex ];
        if (!targetWeek) return;

        const nextDay = logic.pickNextDay(targetWeek.days);
        if (!nextDay) return;

        const updatedWeeks = cloneWeeks(localWeeks);
        updatedWeeks[ weekIndex ].days.push({ day: nextDay, totalWorkingHours: 0, comment: '' });
        await logic.persistWeeks(updatedWeeks);
    }, [ localWeeks, logic ]);

    const handleDayCommentKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>, w: number, d: number) =>
    {
        if (event.key === 'Enter')
        {
            event.preventDefault();
            void logic.saveDayComment(w, d);
        }
    }, [ logic ]);

    const currentWeek = useMemo(() =>
        selectedTab > 0 ? localWeeks[ selectedTab - 1 ] : null,
        [ localWeeks, selectedTab ]);

    const canAddDayToCurrent = useMemo(() =>
        currentWeek ? pickNextDay(currentWeek.days) !== null : false,
        [ currentWeek ]);

    if (!curriculum)
    {
        return (
            <Card sx={ { padding: 2, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                <CircularProgress />
            </Card>
        );
    }

    return (
        <Card sx={ { padding: 2, width: '100%', maxWidth: '22rem' } }>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={ 0.5 }>
                <Typography variant="subtitle1" gutterBottom>שעות עבודה לשיבוץ</Typography>
                <Tooltip title="הוספת שבוע">
                    <span>
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={ () => void addWeek() }
                            disabled={ !canEdit }
                        >
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            <Typography variant="body2" color="text.secondary" mb={ 1.5 }>
                עריכת סך שעות העבודה לכל יום בכל שבוע בתכנית ({ localWeeks.length } שבועות)
            </Typography>

            <Tabs
                value={ selectedTab }
                onChange={ handleTabChange }
                variant='scrollable'
                slots={ {
                    StartScrollButtonIcon: KeyboardArrowLeft,
                    EndScrollButtonIcon: KeyboardArrowRight,
                } }
                sx={ {
                    mb: 1.5,
                    flexDirection: "row-reverse", // TODO: Known issue: https://github.com/mui/material-ui/issues/30409?issue=mui%7Cmaterial-ui%7C30207
                    '& .MuiTabs-scroller': {
                        // Ensures the scroll container respects the RTL flow
                        direction: 'rtl',
                    },
                    '& .MuiTabs-flexContainer': {
                        flexDirection: "row",
                    }
                } }
            >
                <Tab label="סקירה" />
                { localWeeks.map((week) => (
                    <Tab key={ week.number } label={ `שבוע ${week.number}` } />
                )) }
            </Tabs>

            { selectedTab === 0 ? (
                <OverviewTab weeks={ localWeeks } />
            ) : (
                currentWeek && (
                    <Stack spacing={ 1.5 }>
                        <WeekAccordion
                            week={ currentWeek }
                            weekIndex={ selectedTab - 1 }
                            canEdit={ canEdit }
                            canAddDay={ canAddDayToCurrent }
                            onAddDay={ addDay }
                            onWeekCommentChange={ (w, c) => logic.updateWeeksLocally((weeks) =>
                            {
                                weeks[ w ].comment = c;
                                return weeks;
                            }) }
                            onWeekCommentSave={ logic.saveWeekComment }
                            onWeekCommentKeyDown={ logic.onWeekCommentKeyDown }
                            onHoursChange={ (w, d, v) => logic.updateWeeksLocally((weeks) =>
                            {
                                weeks[ w ].days[ d ].totalWorkingHours = Math.max(Number(v) || 0, 0);
                                return weeks;
                            }) }
                            onHoursSave={ logic.saveDayHours }
                            onHoursKeyDown={ logic.onHoursKeyDown }
                            onDayCommentChange={ (w, d, c) => logic.updateWeeksLocally((weeks) =>
                            {
                                weeks[ w ].days[ d ].comment = c;
                                return weeks;
                            }) }
                            onDayCommentSave={ logic.saveDayComment }
                            onDayCommentKeyDown={ handleDayCommentKeyDown }
                        />
                    </Stack>
                )
            ) }
        </Card>
    );
}
