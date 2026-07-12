import ContentCutIcon from "@mui/icons-material/ContentCut";
import { Fragment, useCallback, useState } from "react";

import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { CutToScheduleDialog } from "@/components/gantt/cut-dialog";

/**
 * "גזירה ללו"ז" — opens the cut confirmation dialog for a published
 * curriculum. Only the draft state is gated client-side; every other
 * precondition (linked iteration, one-shot, plan validity) is enforced by the
 * endpoint and rendered by the dialog.
 */
export function CutToScheduleAction({
    sourceCurriculum,
    onProcessingChange: _onProcessingChange,
    loading,
    disabled,
    ...props
}: CurriculumAwareActionItemProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const isDraft = sourceCurriculum?.isDraft !== false;

    const handleClick = useCallback(() => {
        if (!sourceCurriculum) return;
        setDialogOpen(true);
    }, [sourceCurriculum]);

    return (
        <Fragment>
            <ActionItemButton
                disabled={disabled || isDraft}
                loading={loading}
                onClick={handleClick}
                startIcon={<ContentCutIcon fontSize="small" />}
                tooltipTitle={
                    isDraft ? "ניתן לגזור רק מגאנט מוגמר" : 'גזירה ללו"ז'
                }
                {...props}
            />
            {sourceCurriculum ? <CutToScheduleDialog
                curriculumId={sourceCurriculum.id}
                curriculumTitle={sourceCurriculum.title}
                onClose={() => setDialogOpen(false)}
                open={dialogOpen}
            /> : null}
        </Fragment>
    );
}
