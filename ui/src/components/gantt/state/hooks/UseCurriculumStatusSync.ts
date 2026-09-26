import { useEffect } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";

/**
 * Draft/archive status is changed from the curriculum FAB, which only sees the
 * curriculum list store. Mirror those flags into the open curriculum's own
 * store so views reading it (e.g. the cut action's draft gate) stay current.
 *
 * Mount once inside `CurriculumProvider`.
 */
export function useCurriculumStatusSync(curriculumId: GanttCurriculumId | null): void
{
    const { dispatch } = useCurriculumProviderActions();
    const { curriculums } = useCurriculumList();
    const listEntry = curriculumId ? curriculums[ curriculumId ] : undefined;
    const isDraft = listEntry?.isDraft;
    const isArchived = listEntry?.isArchived;

    useEffect(() =>
    {
        if (!curriculumId || !listEntry) return;
        dispatch({
            type: "UPDATE_CURRICULUM",
            payload: { id: curriculumId, updates: { isDraft, isArchived } },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only the two flags matter, not the whole entry
    }, [ curriculumId, dispatch, isDraft, isArchived ]);
}
