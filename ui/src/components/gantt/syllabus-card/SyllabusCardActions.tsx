import GroupsIcon from "@mui/icons-material/Groups";
import LabelIcon from "@mui/icons-material/Label";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Badge from "@mui/material/Badge";
import CardActions, { CardActionsProps } from "@mui/material/CardActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import
{
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

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
    const { openShuffleDialog, openSyllabusLinksDialog } =
        useCurriculumProviderActions();
    const syllabus = useSyllabus(syllabusId);
    const shuffleCount = (syllabus?.shuffles ?? []).length;
    const courseCount = (syllabus?.courseIds ?? []).length;
    const linkCount = courseCount + (syllabus?.leadInstructorIds ?? []).length;

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

    const shufflesHandler = useCallback(
        () => openShuffleDialog(syllabusId),
        [ syllabusId, openShuffleDialog ],
    );

    const linksHandler = useCallback(
        () => openSyllabusLinksDialog(syllabusId),
        [ syllabusId, openSyllabusLinksDialog ],
    );

    return (
        <CardActions { ...props }>
            <Tooltip title="הסרת סילבוס מהגאנט">
                <IconButton
                    color="warning"
                    onClick={ deleteHandler }
                    size="small"
                >
                    <LinkOffIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            {/* The shuffles used to be an inline chip field that only appeared
                on hover; they now have a dialog of their own (#699). */}
            <Tooltip title="שאפלים במקצוע">
                <IconButton
                    color="primary"
                    onClick={ shufflesHandler }
                    size="small"
                >
                    <Badge badgeContent={ shuffleCount } color="primary">
                        <GroupsIcon fontSize="small" />
                    </Badge>
                </IconButton>
            </Tooltip>
            <Tooltip
                title={
                    courseCount === 0
                        ? "שיוך מקצוע — מומלץ לשייך לפחות מסלול אחד"
                        : "שיוך מקצוע (מסלולים ואחראי מקצוע)"
                }
            >
                <IconButton
                    color={ courseCount === 0 ? "warning" : "primary" }
                    onClick={ linksHandler }
                    size="small"
                >
                    <Badge
                        badgeContent={ linkCount }
                        color={ courseCount === 0 ? "warning" : "primary" }
                    >
                        <LabelIcon fontSize="small" />
                    </Badge>
                </IconButton>
            </Tooltip>
        </CardActions>
    );
}
