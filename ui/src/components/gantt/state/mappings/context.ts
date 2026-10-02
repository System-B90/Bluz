import { createContext } from "react";

import {
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { GanttMappingState } from "@/components/gantt/state/mappings/types";

export type RefreshMappings = () => Promise<void>;
export type CreateMapping = ({
    moduleId,
    eventId,
    dayId,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId | null;
    dayId: GanttDayId;
    /** Omitted ⇒ the event's whole minimumDuration. */
    allottedMinutes?: number;
}) => Promise<GanttCurriculumModuleDayMapping | undefined>;
export type MoveMapping = ({
    moduleId,
    eventId,
    from,
    to,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId | null;
    from: { d: GanttDayId };
    to: { d: GanttDayId };
    /** Also re-allots the moved mapping. */
    allottedMinutes?: number;
}) => Promise<void>;
export type RemoveMapping = ({
    moduleId,
    eventId,
    dayId,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId | null;
    dayId: GanttDayId;
}) => Promise<void>;

/** Sets the minutes an event is allotted on one of its mapped days. */
export type SetAllottedMinutes = ({
    moduleId,
    eventId,
    dayId,
    allottedMinutes,
}: {
    moduleId: GanttModuleId;
    eventId: GanttEventId;
    dayId: GanttDayId;
    allottedMinutes: number;
}) => Promise<boolean>;

export type GanttMappingContextType = {
    state: GanttMappingState;
    refreshMappings: RefreshMappings;
    createMapping: CreateMapping;
    moveMapping: MoveMapping;
    removeMapping: RemoveMapping;
    setAllottedMinutes: SetAllottedMinutes;
};

export const GanttMappingContext = createContext<
    GanttMappingContextType | undefined
>(undefined);
