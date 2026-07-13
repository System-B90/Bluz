import Box from "@mui/material/Box";
import { useCallback, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CutToScheduleAction } from "@/components/gantt/curriculum-fab/action-items/CutToScheduleAction";
import { ToggleArchiveAction } from "@/components/gantt/curriculum-fab/action-items/ToggleArchiveAction";
import { ToggleDraftAction } from "@/components/gantt/curriculum-fab/action-items/ToggleDraftAction";
import { useCurriculumSyncRef } from "@/components/gantt/curriculum-fab/curriculum-sync-context";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export type CurriculumStatusActionsProps = {
    curriculumId: GanttCurriculumId | null;
    curriculum: GanttCurriculumDocument | undefined;
};

type ActionKey = "cutToSchedule" | "toggleArchive" | "toggleDraft";

export function CurriculumStatusActions({
    curriculumId,
    curriculum,
}: CurriculumStatusActionsProps) {
    const { dispatch } = useCurriculumProviderActions();
    const syncRef = useCurriculumSyncRef();
    const [activeAction, setActiveAction] = useState<ActionKey | null>(null);

    const makeProcessingHandler = useCallback(
        (key: ActionKey) => (loading: boolean) =>
            setActiveAction(loading ? key : null),
        [],
    );

    const onUpdate = useCallback(
        (updatedCurriculum: GanttCurriculumDocument) => {
            if (!curriculumId) return;
            dispatch({
                type: "UPDATE_CURRICULUM",
                payload: { id: curriculumId, updates: updatedCurriculum },
            });
            syncRef?.current(updatedCurriculum);
        },
        [curriculumId, dispatch, syncRef],
    );

    if (!curriculumId) return null;

    return (
        <Box alignItems="center" display="flex" gap={0.5}>
            <ToggleDraftAction
                disabled={!curriculum}
                loading={activeAction === "toggleDraft"}
                onProcessingChange={makeProcessingHandler("toggleDraft")}
                onUpdate={onUpdate}
                sourceCurriculum={curriculum}
            />
            <ToggleArchiveAction
                disabled={!curriculum}
                loading={activeAction === "toggleArchive"}
                onProcessingChange={makeProcessingHandler("toggleArchive")}
                onUpdate={onUpdate}
                sourceCurriculum={curriculum}
            />
            <CutToScheduleAction
                disabled={!curriculum}
                loading={activeAction === "cutToSchedule"}
                onProcessingChange={makeProcessingHandler("cutToSchedule")}
                sourceCurriculum={curriculum}
            />
        </Box>
    );
}
