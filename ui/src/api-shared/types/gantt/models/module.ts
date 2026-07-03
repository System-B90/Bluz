import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { GanttEventId } from "@/api-shared/types/gantt/models/event";
import { BaseGantItem } from "@/api-shared/types/gantt/models/shared";

export type GanttModule = {
    title: string;
    description: string;
    events: Array<GanttEventId>;
    hiveIds: Array<number>;
    constraints: Array<GanttConstraint>;
    /**
     * Shuffle names (from the parent syllabus) this module applies to.
     * Empty/undefined ⇒ applies to all shuffles.
     */
    shuffles?: Array<string>;
} & BaseGantItem;
export type GanttModuleId = GanttModule["id"];
