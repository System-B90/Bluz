import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import Box from "@mui/material/Box";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { BluzHelpButton } from "@/components/app-onboarding/BluzHelpButton";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CutToScheduleAction } from "@/components/gantt/curriculum-fab/action-items/CutToScheduleAction";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculmImportExportButton } from "@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumImportExportButton";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

export type CurriculumStatusActionsProps = {
    curriculumId: GanttCurriculumId | null;
    curriculum: GanttCurriculumDocument | undefined;
    setCurrentCurriculum?: Dispatch<SetStateAction<GanttCurriculumId | null>>;
} & GanttCreationDeletionCallbackProps;

type ActionKey = "cutToSchedule" | "importExport";

export function CurriculumStatusActions({
    curriculumId,
    curriculum,
    onCreate,
}: CurriculumStatusActionsProps) {
    const { onCreate: contextOnCreate } = useCurriculumList();
    const handleCreate = onCreate ?? contextOnCreate;
    const { openDialog } = useSettingsDialogUrl();
    const [ activeAction, setActiveAction ] = useState<ActionKey | null>(null);

    const makeProcessingHandler = useCallback(
        (key: ActionKey) => (loading: boolean) =>
            setActiveAction(loading ? key : null),
        [],
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

            <ActionItemButton
                command={ { id: "gantt.curriculum.outsiders", keywords: [ "outsiders", "guests", "אנשי חוץ" ] } }
                onClick={ () => openDialog("outsiders") }
                startIcon={ <AssignmentIndIcon fontSize="small" /> }
                tooltipTitle="אנשי חוץ"
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
