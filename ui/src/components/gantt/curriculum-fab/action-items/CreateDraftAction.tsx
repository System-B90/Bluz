import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { makeCurriculum } from "@/api-shared/types/gantt/maker";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { BaseActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type CreateDraftActionProps = {
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
} & BaseActionItemProps;

export function CreateDraftAction({
    onCreate,
    onProcessingChange,
    loading,
    ...props
}: CreateDraftActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        runAction(
            () => ganttApi.curriculum.apiCreate(makeCurriculum()),
            (newCurriculum) => onCreate(newCurriculum),
            "יצירת הגאנט נכשלה!",
        );
    }, [onCreate, runAction]);

    return (
        <ActionItemButton
            command={ { id: "gantt.curriculum.create", keywords: [ "new curriculum", "create", "draft", "גאנט חדש" ] } }
            loading={loading}
            onClick={clickHandler}
            startIcon={<AddCircleOutlineIcon fontSize="small" />}
            tooltipTitle="דראפט חדש"
            {...props}
        />
    );
}
