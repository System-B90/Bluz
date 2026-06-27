import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";

/**
 * State representation for the Gantt constraints context provider.
 */
export type GanttConstraintState = {
    /** Map of constraint IDs to their constraint records. */
    constraints: Record<string, GanttConstraint>;
    
    /** Flag indicating if the constraints are currently loading. */
    isLoading: boolean;
};

/**
 * Action definitions for the Gantt constraints context state reducer.
 */
export type GanttConstraintAction =
    | {
          type: "DELETE_CONSTRAINT";
          payload: { id: string };
      }
    | { type: "SET_CONSTRAINTS"; payload: Array<GanttConstraint> }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "UPSERT_CONSTRAINT"; payload: GanttConstraint };
