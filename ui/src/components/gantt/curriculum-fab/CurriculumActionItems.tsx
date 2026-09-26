import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { useCallback, useState } from "react";

import
{
    GanttCurriculumDocument
} from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CreateCurriculumHoverMenu } from "@/components/gantt/curriculum-fab/action-items/CreateCurriculumHoverMenu";
import { DeleteCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DeleteCurriculumAction";
import { ToggleArchiveAction } from "@/components/gantt/curriculum-fab/action-items/ToggleArchiveAction";
import { ToggleDraftAction } from "@/components/gantt/curriculum-fab/action-items/ToggleDraftAction";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";

type ActionKey =
    | "createDraft"
    | "createFromTemplate"
    | "delete"
    | "duplicate"
    | "toggleArchive"
    | "toggleDraft";

export type GanttCreationDeletionCallbackProps = {
    onCreate?: (newCurriculum: GanttCurriculumDocument) => void;
    onDelete?: (deletedCurriculumId: GanttCurriculumId) => void;
};

export type CurriculumActionItemsProps = {
    disabled: boolean;
    sourceCurriculum?: GanttCurriculumDocument | null;
} & GanttCreationDeletionCallbackProps;

export function CurriculumActionItems({
    onCreate,
    onDelete,
    disabled,
    sourceCurriculum,
}: CurriculumActionItemsProps)
{
    const curriculumList = useCurriculumList();
    const handleCreate = onCreate ?? curriculumList.onCreate;
    const handleDelete = onDelete ?? curriculumList.onDelete;
    const { updateCurriculum } = curriculumList;

    const handleUpdate = useCallback(
        (updated: GanttCurriculumDocument) => updateCurriculum(updated.id, updated),
        [ updateCurriculum ],
    );

    const [ activeAction, setActiveAction ] = useState<ActionKey | null>(null);
    const isProcessing = activeAction !== null;
    const isDisabled = disabled || isProcessing;

    const makeProcessingHandler = useCallback(
        (key: ActionKey) => (loading: boolean) => setActiveAction(loading ? key : null),
        [],
    );

    return (
        <Box
            alignItems={ "center" }
            display="flex"
            flexDirection="row"
            flexWrap={ "wrap" }
            gap={ 0.5 }
            justifyContent={ "center" }
            justifyItems={ "center" }
            sx={ { mt: 1, mb: 0.5 } }
        >
            { /* Creation actions - rare action, hidden behind a hover reveal */ }
            <CreateCurriculumHoverMenu
                activeAction={ activeAction }
                isDisabled={ isDisabled }
                makeProcessingHandler={ makeProcessingHandler }
                onCreate={ handleCreate }
                sourceCurriculum={ sourceCurriculum }
            />

            <Divider flexItem orientation="vertical" sx={ { my: 0.5 } } />

            <ToggleDraftAction
                disabled={ isDisabled || !sourceCurriculum }
                loading={ activeAction === "toggleDraft" }
                onProcessingChange={ makeProcessingHandler("toggleDraft") }
                onUpdate={ handleUpdate }
                sourceCurriculum={ sourceCurriculum }
            />
            <ToggleArchiveAction
                disabled={ isDisabled || !sourceCurriculum }
                loading={ activeAction === "toggleArchive" }
                onProcessingChange={ makeProcessingHandler("toggleArchive") }
                onUpdate={ handleUpdate }
                sourceCurriculum={ sourceCurriculum }
            />

            <Divider flexItem orientation="vertical" sx={ { my: 0.5 } } />

            { /* Destructive action, kept apart to avoid accidental clicks */ }
            <DeleteCurriculumAction
                disabled={ isDisabled || !sourceCurriculum }
                loading={ activeAction === "delete" }
                onDelete={ handleDelete }
                onProcessingChange={ makeProcessingHandler("delete") }
                sourceCurriculum={ sourceCurriculum }
            />

        </Box>
    );
}
