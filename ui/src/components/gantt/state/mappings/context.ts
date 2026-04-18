import { GanttCurriculumModuleDayMapping, GanttDayId, GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { GanttMappingState } from "@/components/gantt/state/mappings/types";
import { createContext } from "react";


export type RefreshMappings = () => Promise<void>;
export type CreateMapping = ({ moduleId, eventId, dayId }: { moduleId: GanttModuleId; eventId: GanttEventId | null; dayId: GanttDayId; }) => Promise<GanttCurriculumModuleDayMapping | undefined>;
export type MoveMapping = ({ moduleId, eventId, from, to }: { moduleId: GanttModuleId; eventId: GanttEventId | null; from: { d: GanttDayId; }; to: { d: GanttDayId; }; }) => Promise<void>;
export type RemoveMapping = ({ moduleId, eventId, dayId }: { moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId; }) => Promise<void>;


export type GanttMappingContextType = {
    state: GanttMappingState;
    refreshMappings: RefreshMappings;
    createMapping: CreateMapping;
    moveMapping: MoveMapping;
    removeMapping: RemoveMapping;
};

/**
 * Provider Context
 */
export const GanttMappingContext = createContext<
    GanttMappingContextType | undefined
>(undefined);
