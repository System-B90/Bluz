import { GanttMappingContext, GanttMappingContextType } from "@/components/gantt/state/mappings/context";
import { useContext } from "react";

/**
 * Hook for specialized access
 */
export function useGanttMappings(): GanttMappingContextType
{
    const context = useContext(GanttMappingContext);
    if (!context)
        throw new Error(
            "useGanttMappings must be used within a GanttMappingProvider",
        );
    return context;
}
