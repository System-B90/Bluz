import EditNoteIcon from "@mui/icons-material/EditNote";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type ToggleDraftActionProps = {
    onUpdate: (updatedCurriculum: GanttCurriculumDocument) => void;
} & CurriculumAwareActionItemProps;

export function ToggleDraftAction({
    sourceCurriculum,
    onUpdate,
    onProcessingChange,
    loading,
    ...props
}: ToggleDraftActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        const nextDraftState = !sourceCurriculum.isDraft;
        runAction(
            () => ganttApi.curriculum.apiUpdate({ id: sourceCurriculum.id, isDraft: nextDraftState }),
            (updatedCurriculum) => onUpdate(updatedCurriculum),
            sourceCurriculum.isDraft ? "פרסום הגאנט נכשל!" : "העברה לדראפט נכשלה!",
        );
    }, [onUpdate, runAction, sourceCurriculum]);

    return (
        <ActionItemButton
            color={sourceCurriculum?.isDraft ? "success" : "warning"}
            loading={loading}
            onClick={clickHandler}
            startIcon={
                sourceCurriculum?.isDraft ? (
                    <TaskAltIcon fontSize="small" />
                ) : (
                    <EditNoteIcon fontSize="small" />
                )
            }
            tooltipTitle={sourceCurriculum?.isDraft ? "פיבלוש" : "החזרה לדראפט"}
            {...props}
        />
    );
}
