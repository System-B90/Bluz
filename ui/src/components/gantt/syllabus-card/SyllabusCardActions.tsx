import LinkOffIcon from "@mui/icons-material/LinkOff";
import {
  CardActions,
  CardActionsProps,
  IconButton,
  Tooltip,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
  GanttCurriculumId,
  GanttSyllabusId,
} from "@/api-shared/types/gantt/models/curriculum";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";

export interface SyllabusCardActionsProps extends CardActionsProps {
  curriculumId: GanttCurriculumId;
  syllabusId: GanttSyllabusId;
}

export function SyllabusCardActions({
  curriculumId,
  syllabusId,
  ...props
}: SyllabusCardActionsProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { unlinkSyllabusFromCurriculum } = useSyllabusActions();

  const deleteHandler = useCallback(() => {
    unlinkSyllabusFromCurriculum(curriculumId, syllabusId).catch((error) =>
      enqueueApiErrorSnackbar(
        enqueueSnackbar,
        `הסרת הסילבוס מהגאנט נכשלה!`,
        error,
      ),
    );
  }, [curriculumId, syllabusId, unlinkSyllabusFromCurriculum, enqueueSnackbar]);

  return (
    <CardActions {...props}>
      <Tooltip title="הסרת הסילבוס מהגאנט">
        <IconButton color="warning" onClick={deleteHandler} size="small">
          <LinkOffIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </CardActions>
  );
}
