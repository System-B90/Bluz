/**
 * Name: types.ts
 * Purpose: Custom application types for Gantt integration
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 * 
 * Note: SVAR Gantt library types are in ./svar-gantt-types/
 */

import type {
    ILink as SvarGanttLink,
    IScaleConfig as SvarGanttScale,
    ITask as SvarGanttTask
} from '@svar-ui/gantt-store';

import
    {
        GanttCurriculum,
        GanttEvent,
        GanttModule,
        GanttSyllabus
    } from '@/api-shared/types/gantt/models/curriculum';

export { SvarGanttLink, SvarGanttScale, SvarGanttTask };

/**
 * SVAR Gantt data update event (custom wrapper around SvarGanttTask)
 */
export interface SvarGanttDataUpdateEvent
{
    action: string;
    obj: SvarGanttTask;
}

/**
 * Gantt data return type from useGanttData hook
 */
export interface GanttDataResult
{
    tasks: Array<SvarGanttTask>;
    links: Array<SvarGanttLink>;
}

/**
 * Props for GanttEngine component
 */
export interface GanttEngineProps
{
    readonly tasks: Array<SvarGanttTask>;
    readonly links: Array<SvarGanttLink>;
    readonly scales: Array<SvarGanttScale>;
    readonly onDataUpdate: (event: SvarGanttDataUpdateEvent) => void;
}

/**
 * Props for MetricItem component
 */
export interface MetricItemProps
{
    readonly label: string;
    readonly value: string;
}

/**
 * Props for data source (used in useGanttData and CurriculumGanttViewInner)
 */
export interface GanttDataSourceProps
{
    readonly curriculum: GanttCurriculum;
    readonly syllabuses: Array<GanttSyllabus>;
    readonly modules: Array<GanttModule>;
    readonly events: Array<GanttEvent>;
}
