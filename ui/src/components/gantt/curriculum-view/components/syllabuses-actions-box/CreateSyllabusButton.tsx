import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useCommand } from "@/components/app-commands/use-command";
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

    useCommand({
        id: "gantt.syllabus.new",
        title: "סילבוס חדש",
        group: COMMAND_GROUPS.gantt,
        icon: <AddIcon />,
        keywords: ["new syllabus", "create syllabus", "add", "סילבוס"],
        run: clickHandler,
    });

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
