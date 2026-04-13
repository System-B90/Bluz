import { OverviewTab } from '@/components/gant/curriculum-view/WorkTimePanel/OverviewTab';
import { WorkTimePanelProps } from '@/components/gant/curriculum-view/WorkTimePanel/types';
import { useWorkTimePanelLogic } from '@/components/gant/curriculum-view/WorkTimePanel/useWorkTimePanelLogic';
import { cloneWeeks, pickNextDay } from '@/components/gant/curriculum-view/WorkTimePanel/utils';
import { WeekAccordion } from '@/components/gant/curriculum-view/WorkTimePanel/WeekAccordion';
import AddIcon from '@mui/icons-material/Add';
import { Box, Card, CircularProgress, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';

export function WorkTimePanel({ curriculumId, curriculum }: WorkTimePanelProps)
{
    const [ localWeeks, setLocalWeeks ] = useState(curriculum?.weeks ?? []);
    const [ selectedTab, setSelectedTab ] = useState(0);

    useEffect(() => setLocalWeeks(cloneWeeks(curriculum?.weeks ?? [])), [ curriculum?.weeks ]);

    const canEdit = Boolean(curriculumId);
    const weekCount = useMemo(() => localWeeks.length, [ localWeeks.length ]);
    const curriculumWeeks = curriculum?.weeks ?? [];

    const logic = useWorkTimePanelLogic(curriculumId, curriculumWeeks, localWeeks, setLocalWeeks);

    const addWeek = async () =>
    {
        const nextNumber = (localWeeks[ localWeeks.length - 1 ]?.number ?? 0) + 1;
        const updatedWeeks = [ ...cloneWeeks(localWeeks), { number: nextNumber, comment: '', days: logic.buildDefaultWeekDays() } ];
        await logic.persistWeeks(updatedWeeks);
        setSelectedTab(updatedWeeks.length);
    };

    const addDay = async (weekIndex: number) =>
    {
        const targetWeek = localWeeks[ weekIndex ];
        if (!targetWeek) return;
        const nextDay = logic.pickNextDay(targetWeek.days);
        if (!nextDay) return;
        const updatedWeeks = cloneWeeks(localWeeks);
        updatedWeeks[ weekIndex ].days.push({ day: nextDay, totalWorkingHours: 0, comment: '' });
        await logic.persistWeeks(updatedWeeks);
    };

    if (!curriculum)
    {
        return <Card sx={ { padding: 2, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' } }><CircularProgress /></Card>;
    }

    return (
        <Card sx={ { padding: 2, width: '100%', maxWidth: '22rem' } }>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={ 0.5 }>
                <Typography variant="subtitle1" gutterBottom>שעות עבודה לשיבוץ</Typography>
                <Tooltip title="הוספת שבוע">
                    <span>
                        <IconButton size="small" color="primary" onClick={ () => void addWeek() } disabled={ !canEdit }>
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={ 1.5 }>
                עריכת סך שעות העבודה לכל יום בכל שבוע בתכנית ({ weekCount } שבועות)
            </Typography>
            <Tabs
                value={ selectedTab }
                onChange={ (_, value) => setSelectedTab(value) }
                variant="scrollable"
                sx={ { mb: 1.5, direction: 'rtl' } }
            >
                <Tab label="סקירה" />
                { localWeeks.map((week) => <Tab key={ week.number } label={ `שבוע ${week.number}` } />) }
            </Tabs>
            { selectedTab === 0 && <OverviewTab weeks={ localWeeks } /> }
            { selectedTab > 0 && localWeeks[ selectedTab - 1 ] && (
                <Stack spacing={ 1.5 }>
                    <WeekAccordion
                        week={ localWeeks[ selectedTab - 1 ] }
                        weekIndex={ selectedTab - 1 }
                        canEdit={ canEdit }
                        canAddDay={ pickNextDay(localWeeks[ selectedTab - 1 ].days) !== null }
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
                        onDayCommentKeyDown={ (event: KeyboardEvent<HTMLInputElement>, w: number, d: number) =>
                        {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            void logic.saveDayComment(w, d);
                        } }
                    />
                </Stack>
            ) }
        </Card>
    );
}
