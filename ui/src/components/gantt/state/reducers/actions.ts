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
    | {
          // Deletes the doc itself, unlike REMOVE_MODULE/REMOVE_SYLLABUS/
          // REMOVE_EVENT which only unlink from the parent (a syllabus can
          // legitimately remain linked elsewhere, #310). Used to discard a
          // temp entity from an optimistic create that failed or was
          // superseded by the real, server-backed doc (#381).
          type: "PURGE_ENTITY";
          payload:
              | { collection: "events"; id: GanttEventId }
              | { collection: "modules"; id: GanttModuleId }
              | { collection: "syllabuses"; id: GanttSyllabusId };
      }

    // Updates
    | { type: "ADD_DAY"; payload: { day: GanttDay & { id: GanttDayId } } }
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

    // Adds
    | {
          type: "ALLOCATE_TIME_TO_MODULE";
          payload: {
              curriculumId: GanttCurriculumId;
              moduleId: GanttModuleId;
              duration: number;
          };
      }
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
