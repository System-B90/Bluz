import {
    GanttDayId,
    GanttModuleId,
    GanttSyllabusId,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

export type DndDragEventActiveData =
    | {
          type: "MODULE";
          syllabusId?: undefined;
          dayId?: GanttDayId | undefined;
          moduleId: GanttModuleId;
      }
    | {
          type: "SORT_MODULE";
          syllabusId: GanttSyllabusId;
          moduleId: GanttModuleId;
          dayId?: undefined;
      }
    | {
          type: "SYLLABUS";
          syllabusId: GanttSyllabusId;
          dayId?: GanttDayId | undefined;
          moduleId?: undefined;
      };

export type DndDragEventOverData =
    | {
          type: "DAY";
          dayId: GanttDayId;
          weekId?: undefined;
      }
    | {
          type: "SIDEBAR";
          dayId?: undefined;
          weekId?: undefined;
      }
    | {
          type: "WEEK";
          dayId?: undefined;
          weekId: GanttWeekId;
          firstDayId: GanttDayId;
      };
