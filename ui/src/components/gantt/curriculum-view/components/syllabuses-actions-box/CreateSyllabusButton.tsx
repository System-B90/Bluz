import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";

export function CreateSyllabusButton({
    curriculumId,
}: {
    curriculumId: GanttCurriculumId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { createSyllabus } = useSyllabusActions();

    const clickHandler = useCallback(() => {
        createSyllabus("סילבוס חדש", curriculumId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "יצירת הסילבוס נכשלה!",
                error,
            ),
        );
    }, [curriculumId, createSyllabus, enqueueSnackbar]);

    return (
        <Button
            onClick={clickHandler}
            size="small"
            startIcon={<AddIcon />}
            variant="contained"
        >
            סילבוס חדש
        </Button>
    );
}
