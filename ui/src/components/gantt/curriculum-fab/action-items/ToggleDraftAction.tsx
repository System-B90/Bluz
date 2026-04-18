import EditNoteIcon from "@mui/icons-material/EditNote";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { ActionItemButton } from "@/components/gantt/curriculum-fab/action-items/ActionItemButton";
import { CurriculumAwareActionItemProps } from "@/components/gantt/curriculum-fab/action-items/ActionItemProps";

export interface ToggleDraftActionProps extends CurriculumAwareActionItemProps {
  onUpdate: (updatedCurriculum: GanttCurriculumDocument) => void;
}

export function ToggleDraftAction({
  sourceCurriculum,
  onUpdate,
  onProcessingChange,
  ...props
}: ToggleDraftActionProps) {
  const { enqueueSnackbar } = useSnackbar();

  const clickHandler = useCallback(() => {
    if (!sourceCurriculum) return;
    onProcessingChange(true);
    const nextDraftState = !sourceCurriculum.isDraft;
    ganttApi.curriculum
      .apiUpdate({ id: sourceCurriculum.id, isDraft: nextDraftState })
      .then((updatedCurriculum) => onUpdate(updatedCurriculum))
      .catch((error) =>
        enqueueApiErrorSnackbar(
          enqueueSnackbar,
          sourceCurriculum.isDraft
            ? "פרסום הגאנט נכשל!"
            : "העברה לדראפט נכשלה!",
          error,
        ),
      )
      .finally(() => onProcessingChange(false));
  }, [enqueueSnackbar, onProcessingChange, onUpdate, sourceCurriculum]);

  return (
    <ActionItemButton
      color={sourceCurriculum?.isDraft ? "success" : "warning"}
      onClick={clickHandler}
      startIcon={
        sourceCurriculum?.isDraft ? (
          <TaskAltIcon fontSize="small" />
        ) : (
          <EditNoteIcon fontSize="small" />
        )
      }
      {...props}
    >
      {sourceCurriculum?.isDraft ? "פיבלוש" : "החזרה לדראפט"}
    </ActionItemButton>
  );
}
