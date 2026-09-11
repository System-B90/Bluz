import Box from "@mui/material/Box";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { BluzHelpButton } from "@/components/app-onboarding/BluzHelpButton";
import { CutToScheduleAction } from "@/components/gantt/curriculum-fab/action-items/CutToScheduleAction";
import { ToggleArchiveAction } from "@/components/gantt/curriculum-fab/action-items/ToggleArchiveAction";
import { ToggleDraftAction } from "@/components/gantt/curriculum-fab/action-items/ToggleDraftAction";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculmImportExportButton } from "@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumImportExportButton";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export type CurriculumStatusActionsProps = {
    curriculumId: GanttCurriculumId | null;
    curriculum: GanttCurriculumDocument | undefined;
    setCurrentCurriculum?: Dispatch<SetStateAction<GanttCurriculumId | null>>;
} & GanttCreationDeletionCallbackProps;

type ActionKey = "cutToSchedule" | "importExport" | "toggleArchive" | "toggleDraft";

export function CurriculumStatusActions({
    curriculumId,
    curriculum,
    onCreate,
}: CurriculumStatusActionsProps) {
    const { dispatch } = useCurriculumProviderActions();
    const { updateCurriculum, onCreate: contextOnCreate } = useCurriculumList();
    const handleCreate = onCreate ?? contextOnCreate;
    const [ activeAction, setActiveAction ] = useState<ActionKey | null>(null);

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
            updateCurriculum(curriculumId, updatedCurriculum);
        },
        [ curriculumId, dispatch, updateCurriculum ],
    );

    if (!curriculumId) return null;

    return (
        <Box alignItems="center" display="flex" gap={ 0.5 }>
            <BluzHelpButton />

            <Box sx={ { flexGrow: 1 } } />

            <CurriculmImportExportButton
                curriculum={ curriculum }
                loading={ activeAction === "importExport" }
                onCreate={ handleCreate }
                onProcessingChange={ makeProcessingHandler("importExport") }
            />

            <ToggleDraftAction
                disabled={ !curriculum }
                loading={ activeAction === "toggleDraft" }
                onProcessingChange={ makeProcessingHandler("toggleDraft") }
                onUpdate={ onUpdate }
                sourceCurriculum={ curriculum }
            />
            <ToggleArchiveAction
                disabled={ !curriculum }
                loading={ activeAction === "toggleArchive" }
                onProcessingChange={ makeProcessingHandler("toggleArchive") }
                onUpdate={ onUpdate }
                sourceCurriculum={ curriculum }
            />
            <CutToScheduleAction
                disabled={ !curriculum }
                loading={ activeAction === "cutToSchedule" }
                onProcessingChange={ makeProcessingHandler("cutToSchedule") }
                sourceCurriculum={ curriculum }
            />
        </Box>
    );
}
