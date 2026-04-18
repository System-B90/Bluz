import { GanttDayId, GanttModuleId, GanttSyllabusId, GanttWeekId } from "@/api-shared/types/gantt/models";
import
    {
        DragEndEvent
    } from "@dnd-kit/core";
type DnDDragEndEvent<T, K> = DragEndEvent;

export type DndDragEventActiveData = {
    type: 'MODULE';
    syllabusId?: undefined;
    dayId?: GanttDayId | undefined;
    moduleId: GanttModuleId;
} | {
    type: 'SYLLABUS';
    syllabusId: GanttSyllabusId;
    dayId?: GanttDayId | undefined;
    moduleId?: undefined;
};

export type DndDragEventOverData = {
    type: 'SIDEBAR';
    dayId?: undefined;
    weekId?: undefined;
} | {
    type: 'WEEK';
    dayId?: undefined;
    weekId: GanttWeekId;
    firstDayId: GanttDayId;
} | {
    type: 'DAY';
    dayId: GanttDayId;
    weekId?: undefined;
};
