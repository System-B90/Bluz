import { useContext } from "react";

import {
    GanttMappingContext,
    GanttMappingContextType,
} from "@/components/gantt/state/mappings/context";

/**
 * Hook for specialized access
 */
export function useGanttMappings(): GanttMappingContextType {
    const context = useContext(GanttMappingContext);
    if (!context)
        throw new Error(
            "useGanttMappings must be used within a GanttMappingProvider",
        );
    return context;
}
