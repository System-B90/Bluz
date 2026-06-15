import Box from "@mui/material/Box";
import { ButtonProps } from "@mui/material/Button";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttCurriculumDocument,
    apiExportCurriculum,
    apiImportCurriculum,
} from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { CreateDraftAction } from "@/components/gantt/curriculum-fab/action-items/CreateDraftAction";
import { DeleteCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DeleteCurriculumAction";
import { DuplicateCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DuplicateCurriculumAction";
import { ToggleDraftAction } from "@/components/gantt/curriculum-fab/action-items/ToggleDraftAction";

export type CreateNewCurriculumProps = {
    disabled: boolean;
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
    onUpdate: (updatedCurriculum: GanttCurriculumDocument) => void;
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
    sourceCurriculum?: GanttCurriculumDocument | null;
} & Omit<ButtonProps, "onClick" | "sx">;

export function CurriculumActionItems({
    onCreate,
    onUpdate,
    onDelete,
    disabled,
    sourceCurriculum,
    ...props
}: CreateNewCurriculumProps) {
    const { enqueueSnackbar } = useSnackbar();
    const [isProcessing, setIsProcessing] = useState(false);
    const isDisabled = disabled || isProcessing;

    const handleExport = useCallback(async () => {
        if (!sourceCurriculum) return null;
        return await apiExportCurriculum(sourceCurriculum.id);
    }, [sourceCurriculum]);

    const handleExportSuccess = useCallback(() => {
        enqueueSnackbar("הגאנט יוצא בהצלחה!", { variant: "success" });
    }, [enqueueSnackbar]);

    const handleExportError = useCallback(
        (error: any) => {
            enqueueApiErrorSnackbar(enqueueSnackbar, "ייצוא הגאנט נכשל!", error);
        },
        [enqueueSnackbar],
    );

    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    setIsProcessing(true);
                    const newCurriculum = await apiImportCurriculum(json);
                    onCreate(newCurriculum);
                    enqueueSnackbar("הגאנט יובא בהצלחה!", { variant: "success" });
                } catch (err) {
                    enqueueApiErrorSnackbar(enqueueSnackbar, "ייבוא הגאנט נכשל!", err);
                } finally {
                    setIsProcessing(false);
                }
            };
            reader.readAsText(file);
        },
        [onCreate, enqueueSnackbar],
    );

    return (
        <Box
            alignItems={"center"}
            display="flex"
            flexDirection="row"
            flexWrap={"wrap"}
            gap={0.5}
            justifyContent={"center"}
            justifyItems={"center"}
            sx={{ mt: 1, mb: 0.5 }}
        >
            <CreateDraftAction
                disabled={isDisabled}
                onCreate={onCreate}
                onProcessingChange={setIsProcessing}
                {...props}
            />
            <DuplicateCurriculumAction
                disabled={isDisabled || !sourceCurriculum}
                onCreate={onCreate}
                onProcessingChange={setIsProcessing}
                sourceCurriculum={sourceCurriculum}
            />
            <ToggleDraftAction
                disabled={isDisabled || !sourceCurriculum}
                onProcessingChange={setIsProcessing}
                onUpdate={onUpdate}
                sourceCurriculum={sourceCurriculum}
            />
            <ImportExportMenuButton
                exportDisabled={isDisabled || !sourceCurriculum}
                exportFilenamePrefix="bluz-gantt-"
                exportTitle={sourceCurriculum?.title}
                iconOnly
                importDisabled={isDisabled}
                onExport={handleExport}
                onExportError={handleExportError}
                onExportSuccess={handleExportSuccess}
                onImport={handleImport}
                variant="outlined"
            />
            <DeleteCurriculumAction
                disabled={isDisabled || !sourceCurriculum}
                onDelete={onDelete}
                onProcessingChange={setIsProcessing}
                sourceCurriculum={sourceCurriculum}
            />
        </Box>
    );
}
