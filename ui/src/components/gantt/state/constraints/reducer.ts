/**
 * Name: reducer.ts
 * Purpose: High-performance state reducer for Gantt constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import {
    GanttConstraintAction,
    GanttConstraintState,
} from "@/components/gantt/state/constraints/types";

export function ganttConstraintReducer(
    state: GanttConstraintState,
    action: GanttConstraintAction,
): GanttConstraintState {
    switch (action.type) {
        case "SET_CONSTRAINTS":
            const newConstraints: Record<string, GanttConstraint> = {};
            action.payload.forEach((c) => {
                newConstraints[c.id] = c;
            });
            return { ...state, constraints: newConstraints, isLoading: false };

        case "UPSERT_CONSTRAINT":
            return {
                ...state,
                constraints: {
                    ...state.constraints,
                    [action.payload.id]: action.payload,
                },
            };

        case "DELETE_CONSTRAINT":
            // Micro-optimization: Object destructuring avoids the `delete` keyword,
            // preventing the de-optimization of V8 hidden classes.
            const { [action.payload.id]: _removedId, ...remainingConstraints } =
                state.constraints;
            return { ...state, constraints: remainingConstraints };

        case "SET_LOADING":
            return { ...state, isLoading: action.payload };

        default:
            return state;
    }
}
