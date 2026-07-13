import {
    GanttDayId,
    GanttEventId,
    GanttEventRecurrenceException,
} from "@/api-shared/types/gantt/models";

export type GanttRecurrenceExceptionState = {
    // Key: `${eventId}-${dayId}`
    exceptions: Record<string, GanttEventRecurrenceException>;
    isLoading: boolean;
};

export type GanttRecurrenceExceptionAction =
    | {
          type: "SET_EXCEPTIONS";
          payload: Array<GanttEventRecurrenceException>;
      }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "UPSERT_EXCEPTION"; payload: GanttEventRecurrenceException };

export const getRecurrenceExceptionKey = (e: {
    eventId: GanttEventId;
    dayId: GanttDayId;
}) => `${e.eventId}-${e.dayId}`;
