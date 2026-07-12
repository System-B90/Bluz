import Box from "@mui/material/Box";
import { ButtonProps } from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import
{
    GanttCurriculumDocument,
    apiExportCurriculum,
    apiImportCurriculum,
} from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { CreateDraftAction } from "@/components/gantt/curriculum-fab/action-items/CreateDraftAction";
import { CreateFromTemplateAction } from "@/components/gantt/curriculum-fab/action-items/CreateFromTemplateAction";
import { CutToScheduleAction } from "@/components/gantt/curriculum-fab/action-items/CutToScheduleAction";
import { DeleteCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DeleteCurriculumAction";
import { DuplicateCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DuplicateCurriculumAction";
import { ToggleArchiveAction } from "@/components/gantt/curriculum-fab/action-items/ToggleArchiveAction";
import { ToggleDraftAction } from "@/components/gantt/curriculum-fab/action-items/ToggleDraftAction";

type ActionKey =
    | "createDraft"
    | "createFromTemplate"
    | "cutToSchedule"
    | "delete"
    | "duplicate"
    | "importExport"
    | "toggleArchive"
    | "toggleDraft";

export type CreateNewCurriculumProps = {
    disabled: boolean;
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
    onUpdate: (updatedCurriculum: GanttCurriculumDocument) => void;
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
    sourceCurriculum?: GanttCurriculumDocument | null;
} & Omit<ButtonProps, "loading" | "onClick" | "sx">;

export function CurriculumActionItems({
    onCreate,
    onUpdate,
    onDelete,
    disabled,
    sourceCurriculum,
    ...props
}: CreateNewCurriculumProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const [ activeAction, setActiveAction ] = useState<ActionKey | null>(null);
    const isProcessing = activeAction !== null;
    const isDisabled = disabled || isProcessing;

    const makeProcessingHandler = useCallback(
        (key: ActionKey) => (loading: boolean) => setActiveAction(loading ? key : null),
        [],
    );

    const handleExport = useCallback(async () =>
    {
        if (!sourceCurriculum) return null;
        setActiveAction("importExport");
        try
        {
            return await apiExportCurriculum(sourceCurriculum.id);
        } finally
        {
            setActiveAction(null);
        }
    }, [ sourceCurriculum ]);

    const handleExportExcel = useCallback(() =>
    {
        if (!sourceCurriculum) return;
        window.open(`/api/gantt/curriculums/${sourceCurriculum.id}/export/excel`, "_blank");
    }, [ sourceCurriculum ]);

    const handleExportSuccess = useCallback(() =>
    {
        enqueueSnackbar("הגאנט יוצא בהצלחה!", { variant: "success" });
    }, [ enqueueSnackbar ]);

    const handleExportError = useCallback(
        (error: any) =>
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "ייצוא הגאנט נכשל!", error);
        },
        [ enqueueSnackbar ],
    );

    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
        {
            const file = e.target.files?.[ 0 ];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) =>
            {
                try
                {
                    const json = JSON.parse(event.target?.result as string);
                    setActiveAction("importExport");
                    const newCurriculum = await apiImportCurriculum(json);
                    onCreate(newCurriculum);
                    enqueueSnackbar("הגאנט יובא בהצלחה!", { variant: "success" });
                } catch (err)
                {
                    enqueueApiErrorSnackbar(enqueueSnackbar, "ייבוא הגאנט נכשל!", err);
                } finally
                {
                    setActiveAction(null);
                }
            };
            reader.readAsText(file);
        },
        [ onCreate, enqueueSnackbar ],
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
            { /* Creation actions */ }
            <Box alignItems="center" display="flex" gap={ 0.5 }>
                <CreateDraftAction
                    disabled={ isDisabled }
                    loading={ activeAction === "createDraft" }
                    onCreate={ onCreate }
                    onProcessingChange={ makeProcessingHandler("createDraft") }
                    { ...props }
                />
                <CreateFromTemplateAction
                    disabled={ isDisabled }
                    loading={ activeAction === "createFromTemplate" }
                    onCreate={ onCreate }
                    onProcessingChange={ makeProcessingHandler("createFromTemplate") }
                    { ...props }
                />
                <DuplicateCurriculumAction
                    disabled={ isDisabled || !sourceCurriculum }
                    loading={ activeAction === "duplicate" }
                    onCreate={ onCreate }
                    onProcessingChange={ makeProcessingHandler("duplicate") }
                    sourceCurriculum={ sourceCurriculum }
                />
            </Box>

            <Divider flexItem orientation="vertical" sx={ { my: 0.5 } } />

            { /* Status / export actions on the current curriculum */ }
            <Box alignItems="center" display="flex" gap={ 0.5 }>
                <ToggleDraftAction
                    disabled={ isDisabled || !sourceCurriculum }
                    loading={ activeAction === "toggleDraft" }
                    onProcessingChange={ makeProcessingHandler("toggleDraft") }
                    onUpdate={ onUpdate }
                    sourceCurriculum={ sourceCurriculum }
                />
                <ToggleArchiveAction
                    disabled={ isDisabled || !sourceCurriculum }
                    loading={ activeAction === "toggleArchive" }
                    onProcessingChange={ makeProcessingHandler("toggleArchive") }
                    onUpdate={ onUpdate }
                    sourceCurriculum={ sourceCurriculum }
                />
                <CutToScheduleAction
                    disabled={ isDisabled || !sourceCurriculum }
                    loading={ activeAction === "cutToSchedule" }
                    onProcessingChange={ makeProcessingHandler("cutToSchedule") }
                    sourceCurriculum={ sourceCurriculum }
                />
                <ImportExportMenuButton
                    exportDisabled={ isDisabled || !sourceCurriculum }
                    exportFilenamePrefix="bluz-gantt-"
                    exportTitle={ sourceCurriculum?.title }
                    iconOnly
                    importDisabled={ isDisabled }
                    loading={ activeAction === "importExport" }
                    onExport={ handleExport }
                    onExportError={ handleExportError }
                    onExportExcel={ handleExportExcel }
                    onExportSuccess={ handleExportSuccess }
                    onImport={ handleImport }
                    variant="outlined"
                />
            </Box>

            <Divider flexItem orientation="vertical" sx={ { my: 0.5 } } />

            { /* Destructive action, kept apart to avoid accidental clicks */ }
            <DeleteCurriculumAction
                disabled={ isDisabled || !sourceCurriculum }
                loading={ activeAction === "delete" }
                onDelete={ onDelete }
                onProcessingChange={ makeProcessingHandler("delete") }
                sourceCurriculum={ sourceCurriculum }
            />
        </Box>
    );
}
