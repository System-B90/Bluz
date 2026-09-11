import Box from "@mui/material/Box";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import {
    apiExportCurriculum,
    apiImportCurriculum,
    GanttCurriculumDocument,
} from "@/api-client/gantt/curriculum";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";

export type CurriculmImportExportButtonProps = {
    curriculum: GanttCurriculumDocument | undefined;
    onProcessingChange: (processing: boolean) => void;
    loading: boolean;
} & Pick<GanttCreationDeletionCallbackProps, "onCreate">;

export function CurriculmImportExportButton({
    curriculum,
    onProcessingChange,
    loading,
    onCreate,
}: CurriculmImportExportButtonProps) {
    const { enqueueSnackbar } = useSnackbar();
    const { onCreate: contextOnCreate } = useCurriculumList();
    const handleCreate = onCreate ?? contextOnCreate;

    const handleExport = useCallback(async () => {
        if (!curriculum) return null;
        onProcessingChange(true);
        try {
            return await apiExportCurriculum(curriculum.id);
        } finally {
            onProcessingChange(false);
        }
    }, [ curriculum, onProcessingChange ]);

    const handleExportExcel = useCallback(() => {
        if (!curriculum) return;
        window.open(
            `/api/gantt/curriculums/${curriculum.id}/export/excel`,
            "_blank",
        );
    }, [ curriculum ]);

    const handleExportSuccess = useCallback(() => {
        enqueueSnackbar("הגאנט יוצא בהצלחה!", { variant: "success" });
    }, [ enqueueSnackbar ]);

    const handleExportError = useCallback(
        (error: any) => {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "ייצוא הגאנט נכשל!",
                error,
            );
        },
        [ enqueueSnackbar ],
    );

    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[ 0 ];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    onProcessingChange(true);
                    const newCurriculum = await apiImportCurriculum(json);
                    handleCreate(newCurriculum);
                    enqueueSnackbar("הגאנט יובא בהצלחה!", { variant: "success" });
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "ייבוא הגאנט נכשל!",
                        err,
                    );
                } finally {
                    onProcessingChange(false);
                }
            };
            reader.readAsText(file);
        },
        [ handleCreate, enqueueSnackbar, onProcessingChange ],
    );

    return (
        <Box alignItems="center" display="flex" gap={ 0.5 }>
            <ImportExportMenuButton
                exportDisabled={ !curriculum }
                exportFilenamePrefix="bluz-gantt-"
                exportTitle={ curriculum?.title }
                iconOnly
                importDisabled={ !curriculum }
                loading={ loading }
                onExport={ handleExport }
                onExportError={ handleExportError }
                onExportExcel={ handleExportExcel }
                onExportSuccess={ handleExportSuccess }
                onImport={ handleImport }
                variant="outlined"
            />
        </Box>
    );
}
