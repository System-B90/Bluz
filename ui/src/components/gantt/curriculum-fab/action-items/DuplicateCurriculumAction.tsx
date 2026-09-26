import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";

export type DuplicateCurriculumActionProps = {
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
} & CurriculumAwareActionItemProps;

export function DuplicateCurriculumAction({
    sourceCurriculum,
    onCreate,
    onProcessingChange,
    loading,
    ...props
}: DuplicateCurriculumActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        // Server-side deep clone: weeks/days, syllabuses/modules/events, event
        // configs and day mappings are all recreated with fresh IDs, so the
        // copy is fully independent of the source (#319, #322).
        runAction(
            () =>
                ganttApi.curriculum.apiDuplicate(sourceCurriculum.id, {
                    title: `${sourceCurriculum.title} (Copy)`,
                    isDraft: true,
                    isArchived: false,
                }),
            (newCurriculum) => onCreate(newCurriculum),
            "שכפול הגאנט נכשל!",
        );
    }, [onCreate, runAction, sourceCurriculum]);

    return (
        <ActionItemButton
            command={{ id: "gantt.curriculum.duplicate", keywords: ["duplicate", "copy", "clone", "שכפול"] }}
            loading={loading}
            onClick={clickHandler}
            startIcon={<ContentCopyIcon fontSize="small" />}
            tooltipTitle="שכפול"
            {...props}
        />
    );
}
