import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import {
    BaseGantItem,
    GanttEventId,
} from "@/api-shared/types/gantt/models/shared";

export type { GanttModuleId } from "@/api-shared/types/gantt/models/shared";

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
    /**
     * Hive id of the instructor new events in this module are pre-filled
     * with as their orchestrator; null for no default. Existing events are
     * left untouched when this changes.
     */
    defaultOrchestratorId: null | number;
} & BaseGantItem;
