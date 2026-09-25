import AddIcon from "@mui/icons-material/Add";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import
{
    GanttSyllabusId,
    ModuleEventType,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";
import { useModuleActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleActions";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

export function CreateModuleButton({
    syllabusId,
}: {
    syllabusId: GanttSyllabusId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { createEvent } = useModuleEventActions();
    const { createModule } = useModuleActions();
    const { openModuleDialog } = useCurriculumProviderActions();
    const [isCreating, setIsCreating] = useState(false);

    const clickHandler = useCallback(async () => {
        setIsCreating(true);
        try {
            const newModule = await createModule(
                "מערך חדש",
                syllabusId,
                "המערך החדש שלי",
            );
            openModuleDialog(syllabusId, newModule.id);
            try {
                await createEvent(
                    "הרצאת מבוא",
                    newModule.id,
                    ModuleEventType.Lecture,
                    60,
                );
                await createEvent(
                    'ע"ע',
                    newModule.id,
                    ModuleEventType.Exercise,
                    45,
                );
            } catch (error) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "יצירת מופעי ברירת מחדל במערך נכשלה!",
                    error,
                );
            }
        } catch (error) {
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "יצירת המערך נכשלה!",
                error,
            );
        } finally {
            setIsCreating(false);
        }
    }, [
        syllabusId,
        enqueueSnackbar,
        createModule,
        createEvent,
        openModuleDialog,
    ]);

    return (
        <Tooltip placement="top" title="יצירת מערך חדש">
            <span>
                <IconButton
                    color="secondary"
                    disabled={isCreating}
                    onClick={clickHandler}
                    size="small"
                >
                    {isCreating ? (
                        <CircularProgress color="inherit" size="1.25rem" />
                    ) : (
                        <AddIcon fontSize="small" />
                    )}
                </IconButton>
            </span>
        </Tooltip>
    );
}
