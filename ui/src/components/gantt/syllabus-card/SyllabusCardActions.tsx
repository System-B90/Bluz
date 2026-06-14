import LinkOffIcon from "@mui/icons-material/LinkOff";
import CardActions, { CardActionsProps } from "@mui/material/CardActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import
{
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";

export type SyllabusCardActionsProps = {
    curriculumId: GanttCurriculumId;
    syllabusId: GanttSyllabusId;
} & CardActionsProps;

export function SyllabusCardActions({
    curriculumId,
    syllabusId,
    ...props
}: SyllabusCardActionsProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { unlinkSyllabusFromCurriculum } = useSyllabusActions();

    const deleteHandler = useCallback(() =>
    {
        unlinkSyllabusFromCurriculum(curriculumId, syllabusId).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                `הסרת הסילבוס מהגאנט נכשלה!`,
                error,
            ),
        );
    }, [
        curriculumId,
        syllabusId,
        unlinkSyllabusFromCurriculum,
        enqueueSnackbar,
    ]);

    return (
        <CardActions { ...props }>
            <Tooltip title="הסר סילבוס מהגאנט">
                <IconButton
                    color="warning"
                    onClick={ deleteHandler }
                    size="small"
                >
                    <LinkOffIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </CardActions>
    );
}
