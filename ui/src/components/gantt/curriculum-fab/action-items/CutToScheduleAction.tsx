import ContentCutIcon from "@mui/icons-material/ContentCut";
import UndoIcon from "@mui/icons-material/Undo";
import { Fragment, useCallback, useEffect, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";
import { CutToScheduleDialog } from "@/components/gantt/cut-dialog";
import { PullBackScheduleDialog } from "@/components/gantt/cut-dialog/PullBackScheduleDialog";

type DialogMode = "cut" | "pullBack" | null;

/**
 * "גזירה ללו"ז" / "משיכה חזרה" — a single status-aware action. Once a
 * curriculum has been cut, the cut button is replaced by a pull-back button
 * that soft-deletes the generated schedule events. Cut status is fetched from
 * the endpoint and re-synced whenever either action succeeds. Draft gating and
 * every other precondition are enforced server-side and surfaced by the dialog.
 */
export function CutToScheduleAction({
    sourceCurriculum,
    onProcessingChange: _onProcessingChange,
    loading,
    disabled,
    ...props
}: CurriculumAwareActionItemProps) {
    // The open dialog is driven by a captured mode, not by `isCut` directly, so
    // flipping `isCut` on success does not unmount the dialog mid-message.
    const [dialogMode, setDialogMode] = useState<DialogMode>(null);
    const [isCut, setIsCut] = useState(false);
    const isDraft = sourceCurriculum?.isDraft !== false;
    const curriculumId = sourceCurriculum?.id;

    useEffect(() => {
        if (!curriculumId) return;
        let active = true;
        ganttApi.cut
            .status(curriculumId)
            .then((status) => {
                if (active) setIsCut(status.cut);
            })
            .catch(() => {
                if (active) setIsCut(false);
            });
        return () => {
            active = false;
        };
    }, [curriculumId]);

    const handleClick = useCallback(() => {
        if (!sourceCurriculum) return;
        setDialogMode(isCut ? "pullBack" : "cut");
    }, [sourceCurriculum, isCut]);

    const handleClose = useCallback(() => setDialogMode(null), []);

    // A cut is disabled without a curriculum or while still a draft; a pull-back
    // stays available regardless of draft state so a cut is always reversible.
    const buttonDisabled = isCut ? disabled : disabled || isDraft;

    return (
        <Fragment>
            <ActionItemButton
                color={isCut ? "warning" : undefined}
                disabled={buttonDisabled}
                loading={loading}
                onClick={handleClick}
                startIcon={
                    isCut ? (
                        <UndoIcon fontSize="small" />
                    ) : (
                        <ContentCutIcon fontSize="small" />
                    )
                }
                tooltipTitle={
                    isCut
                        ? 'משיכת הלו"ז חזרה'
                        : isDraft
                            ? "ניתן לגזור רק מגאנט מוגמר"
                            : 'גזירה ללו"ז'
                }
                {...props}
            />
            {sourceCurriculum ? (
                <CutToScheduleDialog
                    curriculumId={sourceCurriculum.id}
                    curriculumTitle={sourceCurriculum.title}
                    onClose={handleClose}
                    onSuccess={() => setIsCut(true)}
                    open={dialogMode === "cut"}
                />
            ) : null}
            {sourceCurriculum ? (
                <PullBackScheduleDialog
                    curriculumId={sourceCurriculum.id}
                    curriculumTitle={sourceCurriculum.title}
                    onClose={handleClose}
                    onSuccess={() => setIsCut(false)}
                    open={dialogMode === "pullBack"}
                />
            ) : null}
        </Fragment>
    );
}
