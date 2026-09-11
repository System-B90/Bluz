import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import { useCallback, useState } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
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
 * Creating a curriculum is a rare action, so the concrete options (blank /
 * duplicate / template) stay hidden behind a single trigger and only reveal
 * on hover (or click, for touch devices without hover).
 */
export function CreateCurriculumHoverMenu({
    isDisabled,
    activeAction,
    onCreate,
    makeProcessingHandler,
    sourceCurriculum,
}: CreateCurriculumHoverMenuProps)
{
    const [ expanded, setExpanded ] = useState(false);

    const handleEnter = useCallback(() => setExpanded(true), []);
    const handleLeave = useCallback(() => setExpanded(false), []);

    return (
        <Box
            alignItems="center"
            display="flex"
            onMouseEnter={ handleEnter }
            onMouseLeave={ handleLeave }
        >
            <ActionItemButton
                aria-expanded={ expanded }
                disabled={ isDisabled }
                onClick={ undefined }
                startIcon={ <AddIcon fontSize="small" /> }
                tooltipTitle="גאנט חדש"
            />
            <Collapse in={ expanded } orientation="horizontal">
                <Box alignItems="center" display="flex" gap={ 0.5 } sx={ { paddingInlineStart: 0.5 } }>
                    <CreateDraftAction
                        disabled={ isDisabled }
                        loading={ activeAction === "createDraft" }
                        onCreate={ onCreate }
                        onProcessingChange={ makeProcessingHandler("createDraft") }
                    />
                    <DuplicateCurriculumAction
                        disabled={ isDisabled || !sourceCurriculum }
                        loading={ activeAction === "duplicate" }
                        onCreate={ onCreate }
                        onProcessingChange={ makeProcessingHandler("duplicate") }
                        sourceCurriculum={ sourceCurriculum }
                    />
                    <CreateFromTemplateAction
                        disabled={ isDisabled }
                        loading={ activeAction === "createFromTemplate" }
                        onCreate={ onCreate }
                        onProcessingChange={ makeProcessingHandler("createFromTemplate") }
                    />
                </Box>
            </Collapse>
        </Box>
    );
}
