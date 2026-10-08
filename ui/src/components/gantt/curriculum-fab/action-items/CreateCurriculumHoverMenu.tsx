import Box from "@mui/material/Box";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { CreateDraftAction } from "@/components/gantt/curriculum-fab/action-items/CreateDraftAction";
import { CreateFromTemplateAction } from "@/components/gantt/curriculum-fab/action-items/CreateFromTemplateAction";
import { DuplicateCurriculumAction } from "@/components/gantt/curriculum-fab/action-items/DuplicateCurriculumAction";

export type CreateCurriculumHoverMenuProps = {
    isDisabled: boolean;
    activeAction: null | string;
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
    makeProcessingHandler: (
        key: "createDraft" | "createFromTemplate" | "duplicate",
    ) => (loading: boolean) => void;
    sourceCurriculum?: GanttCurriculumDocument | null;
};

/**
 * Create options (blank / duplicate / template) sit next to a static "+"
 * label. They are always visible: no hover-reveal, no collapse animation.
 */
export function CreateCurriculumHoverMenu({
    isDisabled,
    activeAction,
    onCreate,
    makeProcessingHandler,
    sourceCurriculum,
}: CreateCurriculumHoverMenuProps) {
    return (
        <Box alignItems="center" display="flex">
            <Box
                alignItems="center"
                display="flex"
                gap={0.5}
                sx={{ paddingInlineStart: 0.5 }}
            >
                <CreateDraftAction
                    disabled={isDisabled}
                    loading={activeAction === "createDraft"}
                    onCreate={onCreate}
                    onProcessingChange={makeProcessingHandler("createDraft")}
                />
                <DuplicateCurriculumAction
                    disabled={isDisabled || !sourceCurriculum}
                    loading={activeAction === "duplicate"}
                    onCreate={onCreate}
                    onProcessingChange={makeProcessingHandler("duplicate")}
                    sourceCurriculum={sourceCurriculum}
                />
                <CreateFromTemplateAction
                    disabled={isDisabled}
                    loading={activeAction === "createFromTemplate"}
                    onCreate={onCreate}
                    onProcessingChange={makeProcessingHandler(
                        "createFromTemplate",
                    )}
                />
            </Box>
        </Box>
    );
}
