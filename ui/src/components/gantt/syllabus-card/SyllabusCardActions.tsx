import LinkOffIcon from "@mui/icons-material/LinkOff";
import CardActions, { CardActionsProps } from "@mui/material/CardActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import
{
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { SyllabusShuffles } from "@/components/gantt/syllabus-card/SyllabusShuffles";

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
    const [ isHovered, setIsHovered ] = useState(false);

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
        <CardActions onMouseEnter={ () => setIsHovered(true) } onMouseLeave={ () => setIsHovered(false) } { ...props }>
            <Tooltip title="הסרת סילבוס מהגאנט">
                <IconButton
                    color="warning"
                    onClick={ deleteHandler }
                    size="small"
                >
                    <LinkOffIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <SyllabusShuffles isHovered={ isHovered } syllabusId={ syllabusId } />
        </CardActions>
    );
}
