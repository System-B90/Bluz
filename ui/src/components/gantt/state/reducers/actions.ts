import { NormalizedSyllabusSubtree } from "@/api-client/gantt/drizzle-normalize";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import {
    GanttCurriculum,
    GanttCurriculumId,
    GanttDay,
    GanttDayId,
    GanttEvent,
    GanttEventId,
    GanttModule,
    GanttModuleId,
    GanttSyllabus,
    GanttSyllabusId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

export type Action =
    | { type: "ADD_DAY"; payload: { day: GanttDay & { id: GanttDayId } } }

    // Updates
    | {
          type: "ADD_EVENT";
          payload: { moduleId: GanttModuleId; event: GanttEvent };
      }
    | {
          type: "ADD_MODULE";
          payload: { syllabusId: GanttSyllabusId; module: GanttModule };
      }
    | {
          type: "ADD_SYLLABUS";
          payload: { curriculumId: GanttCurriculumId; syllabus: GanttSyllabus };
      }
    | {
          type: "ADD_WEEK";
          payload: {
              week: GanttWeek & { id: GanttWeekId };
              curriculumId: GanttCurriculumId;
          };
      }
    | {
          type: "ALLOCATE_TIME_TO_MODULE";
          payload: {
              curriculumId: GanttCurriculumId;
              moduleId: GanttModuleId;
              duration: number;
          };
      }

    // Adds
    | {
          type: "ALLOCATE_TIME";
          payload: {
              curriculumId: GanttCurriculumId;
              eventId: GanttEventId;
              duration: number;
          };
      }
    | {
          type: "MERGE_SYLLABUS";
          payload: {
              curriculumId: GanttCurriculumId;
          } & NormalizedSyllabusSubtree;
      }
    | {
          type: "MOVE_EVENT";
          payload: {
              eventId: GanttEventId;
              fromModuleId: GanttModuleId;
              toModuleId: GanttModuleId;
          };
      }

    // Removes
    | { type: "REMOVE_DAY"; payload: { dayId: GanttDayId } }
    | {
          type: "REMOVE_EVENT";
          payload: { moduleId: GanttModuleId; eventId: GanttEventId };
      }
    | {
          type: "REMOVE_MODULE";
          payload: { syllabusId: GanttSyllabusId; moduleId: GanttModuleId };
      }
    | {
          type: "REMOVE_SYLLABUS";
          payload: {
              curriculumId: GanttCurriculumId;
              syllabusId: GanttSyllabusId;
          };
      }
    | {
          type: "REMOVE_WEEK";
          payload: { weekId: GanttWeekId; curriculumId: GanttCurriculumId };
      }
    | {
          type: "REORDER_EVENTS";
          payload: { moduleId: GanttModuleId; eventIds: Array<GanttEventId> };
      }
    | {
          type: "REORDER_MODULES";
          payload: { syllabusId: GanttSyllabusId; moduleIds: Array<GanttModuleId> };
      }
    | { type: "SET_DATA"; payload: ApiCurriculum }
    | {
          type: "UPDATE_CURRICULUM";
          payload: { id: GanttCurriculumId; updates: Partial<GanttCurriculum> };
      }
    | {
          type: "UPDATE_DAY";
          payload: { id: GanttDayId; updates: Partial<GanttDay> };
      }
    | {
          type: "UPDATE_EVENT";
          payload: { id: GanttEventId; updates: Partial<GanttEvent> };
      }
    | {
          type: "UPDATE_MODULE";
          payload: { id: GanttModuleId; updates: Partial<GanttModule> };
      }
    | {
          type: "UPDATE_SYLLABUS";
          payload: { id: GanttSyllabusId; updates: Partial<GanttSyllabus> };
      }
    | {
          type: "UPDATE_WEEK";
          payload: { id: GanttWeekId; updates: Partial<GanttWeek> };
      };
