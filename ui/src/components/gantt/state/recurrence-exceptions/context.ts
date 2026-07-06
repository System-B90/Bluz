import { createContext } from "react";

import {
    GanttDayId,
    GanttEvent,
    GanttEventId,
    GanttEventRecurrenceException,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { GanttRecurrenceExceptionState } from "@/components/gantt/state/recurrence-exceptions/types";

export type RefreshRecurrenceExceptions = () => Promise<void>;

export type DeleteOccurrence = ({
    eventId,
    dayId,
}: {
    eventId: GanttEventId;
    dayId: GanttDayId;
}) => Promise<GanttEventRecurrenceException | undefined>;

export type MaterializeOccurrence = ({
    moduleId,
    eventId,
    dayId,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId;
    dayId: GanttDayId;
}) => Promise<{ event: GanttEvent & { id: GanttEventId } } | undefined>;

export type GanttRecurrenceExceptionContextType = {
    state: GanttRecurrenceExceptionState;
    refreshExceptions: RefreshRecurrenceExceptions;
    deleteOccurrence: DeleteOccurrence;
    materializeOccurrence: MaterializeOccurrence;
};

export const GanttRecurrenceExceptionContext = createContext<
    GanttRecurrenceExceptionContextType | undefined
>(undefined);
