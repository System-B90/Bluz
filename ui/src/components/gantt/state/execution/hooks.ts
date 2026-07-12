import { useContext } from "react";

import {
    GanttExecutionContext,
    GanttExecutionContextType,
} from "@/components/gantt/state/execution/context";

export function useGanttExecution(): GanttExecutionContextType {
    const context = useContext(GanttExecutionContext);
    if (!context)
        throw new Error(
            "useGanttExecution must be used within a GanttExecutionProvider",
        );
    return context;
}
