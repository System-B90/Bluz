import { useContext } from "react";

import {
    GanttRecurrenceExceptionContext,
    GanttRecurrenceExceptionContextType,
} from "@/components/gantt/state/recurrence-exceptions/context";

export function useGanttRecurrenceExceptions(): GanttRecurrenceExceptionContextType {
    const context = useContext(GanttRecurrenceExceptionContext);
    if (!context)
        throw new Error(
            "useGanttRecurrenceExceptions must be used within a GanttRecurrenceExceptionProvider",
        );
    return context;
}
