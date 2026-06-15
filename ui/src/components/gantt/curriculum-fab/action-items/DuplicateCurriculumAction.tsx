import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { CreateGanttCurriculumPayload } from "@/api-shared/types/gantt/create-payloads";
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
    ...props
}: DuplicateCurriculumActionProps) {
    const runAction = useAsyncAction(onProcessingChange);

    const clickHandler = useCallback(() => {
        if (!sourceCurriculum) return;
        const payload: Omit<CreateGanttCurriculumPayload, "weeks"> & {
            weeks: typeof sourceCurriculum.weeks;
        } = {
            title: `${sourceCurriculum.title} (Copy)`,
            description: sourceCurriculum.description,
            startDate: sourceCurriculum.startDate,
            isDraft: true,
            weeks: sourceCurriculum.weeks,
        };
        // Cast to proper type - duplication uses the same week IDs structure
        runAction(
            () => ganttApi.curriculum.apiCreate(payload as CreateGanttCurriculumPayload),
            (newCurriculum) => onCreate(newCurriculum),
            "שכפול הגאנט נכשל!",
        );
    }, [onCreate, runAction, sourceCurriculum]);

    return (
        <ActionItemButton
            onClick={clickHandler}
            startIcon={<ContentCopyIcon fontSize="small" />}
            tooltipTitle="שכפול"
            {...props}
        />
    );
}
