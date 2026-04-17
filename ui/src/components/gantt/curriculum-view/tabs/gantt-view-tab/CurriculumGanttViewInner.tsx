/**
 * Name: CurriculumGanttViewInner.tsx
 * Purpose: Inner component that renders the Gantt chart with interaction handling.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

'use client';

import { Paper } from '@mui/material';
import dayjs from 'dayjs';
import React, { useCallback, useMemo } from 'react';

import { useCurriculumMappings } from '@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';
import GanttEngine from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/GanttEngine';
import { GanttDataResult, GanttDataSourceProps, SvarGanttDataUpdateEvent, SvarGanttScale } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/types';
import { useGanttData } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/useGanttData';

/**
 * Inner component that handles Gantt rendering with data transformation
 */
export function CurriculumGanttViewInner(props: GanttDataSourceProps): React.ReactElement
{
    const { moveModule } = useCurriculumMappings();
    const { tasks, links }: GanttDataResult = useGanttData(props);

    const scales: Array<SvarGanttScale> = useMemo(
        (): Array<SvarGanttScale> => [
            {
                unit: 'weeks',
                step: 1,
                format: 'Week %W'
            }
        ],
        []
    );

    const handleDataUpdate = useCallback(
        (event: SvarGanttDataUpdateEvent): void =>
        {
            if (event.action !== 'update' || !event.obj.moduleId) return;

            const oldMapping = event.obj.origin;
            if (!oldMapping) return;

            const newDate: dayjs.Dayjs = dayjs(event.obj.start_date);
            const anchor: dayjs.Dayjs = dayjs().startOf('week');
            const newWeekIndex: number = Math.floor(newDate.diff(anchor, 'week'));
            const newDayIndex: number = newDate.day();

            if (newWeekIndex === oldMapping.weekIndex && newDayIndex === oldMapping.dayIndex)
            {
                return;
            }

            moveModule(
                event.obj.moduleId,
                { w: oldMapping.weekIndex, d: oldMapping.dayIndex },
                { w: newWeekIndex, d: newDayIndex }
            );
        },
        [ moveModule ]
    );

    return (
        <Paper sx={ { flexGrow: 1, overflow: 'hidden' } } variant="outlined">
            <GanttEngine
                links={ links }
                onDataUpdate={ handleDataUpdate }
                scales={ scales }
                tasks={ tasks }
            />
        </Paper>
    );
}
