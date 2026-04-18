/**
 * Name: useGanttData.ts
 * Purpose: Hook to transform curriculum data into SVAR-compatible Gantt tasks.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

import dayjs from 'dayjs';
import { useMemo } from 'react';

import
    {
        GanttDayId,
        GanttModule,
        GanttSyllabus
    } from '@/api-shared/types/gantt/models/curriculum';
import { useCurriculumMappings } from '@/components/gantt/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';
import { GanttDataResult, GanttDataSourceProps, SvarGanttLink, SvarGanttTask } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/types';

/**
 * Hook to map the curriculum hierarchy and mappings into SVAR-compatible tasks
 */
export const useGanttData = (props: GanttDataSourceProps): GanttDataResult =>
{
    const { state: { mappings } } = useCurriculumMappings();

    return useMemo((): GanttDataResult =>
    {
        const tasks: Array<SvarGanttTask> = [];
        const links: Array<SvarGanttLink> = [];

        // Helper function to calculate date range for a date
        const calculateTaskDate = (dayId: GanttDayId): { start: Date; end: Date; } =>
        {
            // TODO: Implement this properly
            const startDate: Date = dayjs()
                .toDate();

            const endDate: Date = dayjs(startDate)
                .add(1, 'day')
                .toDate();

            return { start: startDate, end: endDate };
        };

        props.syllabuses.forEach((syllabus: GanttSyllabus): void =>
        {
            const syllabusTaskId: string = `syllabus-${syllabus.id}`;
            let syllabusMinDate: Date | null = null;
            let syllabusMaxDate: Date | null = null;

            const syllabusChildren: Array<SvarGanttTask> = [];

            syllabus.modules.forEach((mId: string): void =>
            {
                const moduleDoc: GanttModule | undefined = props.modules.find(
                    (m: GanttModule): boolean => m.id === mId
                );
                if (!moduleDoc) return;

                // Find all days this module is mapped to
                const moduleMappings = Object.values(mappings).filter(
                    (m): boolean => m.moduleId === mId
                );

                moduleMappings.forEach((mapping): void =>
                {
                    const { start: startDate, end: endDate } = calculateTaskDate(
                        mapping.dayId
                    );

                    if (!syllabusMinDate || startDate < syllabusMinDate)
                    {
                        syllabusMinDate = startDate;
                    }
                    if (!syllabusMaxDate || endDate > syllabusMaxDate)
                    {
                        syllabusMaxDate = endDate;
                    }

                    const taskItem: SvarGanttTask = {
                        id: `mapping-${mapping.moduleId}-${mapping.dayId}`,
                        parent: syllabusTaskId,
                        text: moduleDoc.title,
                        start_date: startDate,
                        end_date: endDate,
                        type: 'task',
                        moduleId: moduleDoc.id,
                        origin: mapping
                    };

                    syllabusChildren.push(taskItem);
                });
            });

            // Create syllabus task with calculated date range, or use defaults if no children
            const now: Date = new Date();
            const syllabusDates = {
                start: syllabusMinDate ?? now,
                end: syllabusMaxDate ?? dayjs(now).add(1, 'day').toDate()
            };

            tasks.push({
                id: syllabusTaskId,
                text: syllabus.title,
                type: 'project',
                open: true,
                start: syllabusDates.start,
                duration: syllabusDates.end.getDate() - syllabusDates.start.getDate(),
            });

            // Add all children tasks
            tasks.push(...syllabusChildren);
        });

        return { tasks, links };
    }, [ props.syllabuses, props.modules, mappings ]);
};
