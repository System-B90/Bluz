import { EnqueueSnackbar } from "notistack";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";

export type CurriculumGroups = {
    active: Array<GanttCurriculumId>;
    drafts: Array<GanttCurriculumId>;
    archived: Array<GanttCurriculumId>;
};

function byUpdatedAtDesc(
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

export async function fetchDrawerData({
    isMounted,
    enqueueSnackbar,
    setCurriculumsData,
    setIsFetchingDetails,
}: {
    isMounted: boolean;
    enqueueSnackbar: EnqueueSnackbar;
    setCurriculumsData: React.Dispatch<
        React.SetStateAction<Record<GanttCurriculumId, GanttCurriculumDocument>>
    >;
    setIsFetchingDetails: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<void> {
    try {
        const listData = await ganttApi.curriculum.apiList();
        const keys: Array<GanttCurriculumId> = Object.keys(listData);

        if (keys.length === 0) {
            if (isMounted) {
                setCurriculumsData(
                    {} as Record<GanttCurriculumId, GanttCurriculumDocument>,
                );
                setIsFetchingDetails(false);
            }
            return;
        }

        const detailedData = await ganttApi.curriculum.apiGetMany(keys);

        if (isMounted) {
            setCurriculumsData(
                detailedData as Record<
                    GanttCurriculumId,
                    GanttCurriculumDocument
                >,
            );
        }
    } catch (error) {
        enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, error);
    } finally {
        if (isMounted) {
            setIsFetchingDetails(false);
        }
    }
}
