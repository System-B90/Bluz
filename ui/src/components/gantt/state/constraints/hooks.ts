import { useContext } from "react";

import {
    GanttConstraintContext,
    GanttConstraintContextType,
} from "@/components/gantt/state/constraints/context";

/**
 * Hook for specialized access
 */
export function useGanttConstraints(): GanttConstraintContextType {
    const context = useContext(GanttConstraintContext);
    if (!context)
        throw new Error(
            "useGanttConstraints must be used within a GanttConstraintProvider",
        );
    return context;
}
