import { createContext } from "react";

import { GanttEventExecution } from "@/api-shared/types/gantt/execution";
import { GanttEventId } from "@/api-shared/types/gantt/models";

export type GanttExecutionState = {
    /** Keyed by gantt event id; empty ⇒ curriculum not cut (or still loading). */
    events: Record<GanttEventId, GanttEventExecution>;
    isLoading: boolean;
    /** True once at least one fetch completed (distinguishes "not cut" from "loading"). */
    hasLoaded: boolean;
};

export type GanttExecutionContextType = {
    state: GanttExecutionState;
    /** Re-fetches the execution comparison from the server. */
    refreshExecution: () => Promise<void>;
};

export const GanttExecutionContext = createContext<
    GanttExecutionContextType | undefined
>(undefined);
