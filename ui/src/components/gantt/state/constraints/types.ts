/**
 * Name: types.ts
 * Purpose: State definitions and actions for the Gantt constraints context provider.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";

export type GanttConstraintState = {
  // Key: constraint.id
  constraints: Record<string, GanttConstraint>;
  isLoading: boolean;
};

export type GanttConstraintAction =
  | {
      type: "DELETE_CONSTRAINT";
      payload: { id: string };
    }
  | { type: "SET_CONSTRAINTS"; payload: Array<GanttConstraint> }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "UPSERT_CONSTRAINT"; payload: GanttConstraint };
