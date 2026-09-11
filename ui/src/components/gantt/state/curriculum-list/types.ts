import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";

export type CurriculumGroups = {
    active: Array<GanttCurriculumId>;
    drafts: Array<GanttCurriculumId>;
    archived: Array<GanttCurriculumId>;
};

export type CurriculumListState = {
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>;
    isLoading: boolean;
    error: null | string;
};

export type CurriculumListAction =
    | { type: "ADD_CURRICULUM"; payload: GanttCurriculumDocument }
    | { type: "REMOVE_CURRICULUM"; payload: GanttCurriculumId }
    | {
          type: "SET_CURRICULUMS";
          payload: Record<GanttCurriculumId, GanttCurriculumDocument>;
      }
    | { type: "SET_ERROR"; payload: null | string }
    | { type: "SET_LOADING"; payload: boolean }
    | {
          type: "UPDATE_CURRICULUM";
          payload: {
              id: GanttCurriculumId;
              updates: Partial<GanttCurriculumDocument>;
          };
      };

export function byUpdatedAtDesc(
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>,
) {
    return (a: GanttCurriculumId, b: GanttCurriculumId) => {
        const dataA = curriculums[a];
        const dataB = curriculums[b];
        if (!dataA || !dataB) return 0;
        return dataB.updatedAt.diff(dataA.updatedAt);
    };
}

/**
 * Split curriculums into three buckets — active, drafts, archived — each sorted
 * by `updatedAt` descending. Render order is active → drafts → archived.
 */
export function groupCurriculumsByStatus(
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>,
): CurriculumGroups {
    const ids = Object.keys(curriculums) as Array<GanttCurriculumId>;
    const sorter = byUpdatedAtDesc(curriculums);

    const active: Array<GanttCurriculumId> = [];
    const drafts: Array<GanttCurriculumId> = [];
    const archived: Array<GanttCurriculumId> = [];

    for (const id of ids) {
        const data = curriculums[id];
        if (!data) continue;
        if (data.isArchived) archived.push(id);
        else if (data.isDraft) drafts.push(id);
        else active.push(id);
    }

    active.sort(sorter);
    drafts.sort(sorter);
    archived.sort(sorter);

    return { active, drafts, archived };
}

/** Flatten groups into a single render/selection order: active → drafts → archived. */
export function flattenCurriculumGroups(
    groups: CurriculumGroups,
): Array<GanttCurriculumId> {
    return [...groups.active, ...groups.drafts, ...groups.archived];
}
