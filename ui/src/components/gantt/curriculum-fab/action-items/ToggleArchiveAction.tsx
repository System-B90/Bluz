import ArchiveIcon from "@mui/icons-material/Archive";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type ToggleArchiveActionProps = {
    onUpdate: (updatedCurriculum: GanttCurriculumDocument) => void;
} & CurriculumAwareActionItemProps;

export function ToggleArchiveAction({
    sourceCurriculum,
    onUpdate,
    onProcessingChange,
    ...props
}: ToggleArchiveActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        const nextArchivedState = !sourceCurriculum.isArchived;
        runAction(
            () =>
                ganttApi.curriculum.apiUpdate({
                    id: sourceCurriculum.id,
                    isArchived: nextArchivedState,
                    // Draft status is independent of archival — an archived
                    // curriculum may still be a draft.
                }),
            (updatedCurriculum) => onUpdate(updatedCurriculum),
            sourceCurriculum.isArchived
                ? "שחזור הגאנט נכשל!"
                : "העברה לארכיון נכשלה!",
        );
    }, [onUpdate, runAction, sourceCurriculum]);

    return (
        <ActionItemButton
            color={sourceCurriculum?.isArchived ? "info" : "inherit"}
            onClick={clickHandler}
            startIcon={
                sourceCurriculum?.isArchived ? (
                    <UnarchiveIcon fontSize="small" />
                ) : (
                    <ArchiveIcon fontSize="small" />
                )
            }
            tooltipTitle={
                sourceCurriculum?.isArchived ? "שחזור מארכיון" : "העברה לארכיון"
            }
            {...props}
        />
    );
}
