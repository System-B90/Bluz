import EditIcon from "@mui/icons-material/Edit";
import GroupsIcon from "@mui/icons-material/Groups";
import LabelIcon from "@mui/icons-material/Label";
import Button from "@mui/material/Button";
import CardActions, { CardActionsProps } from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useCallback } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export type SyllabusCardActionsProps = {
    syllabusId: GanttSyllabusId;
} & CardActionsProps;

/**
 * One entry point to the syllabus dialog, plus read-only chips for the counts
 * the separate shuffles/שיוך/unlink icons used to carry as badges.
 */
export function SyllabusCardActions({
    syllabusId,
    ...props
}: SyllabusCardActionsProps)
{
    const { openSyllabusDialog } = useCurriculumProviderActions();
    const syllabus = useSyllabus(syllabusId);
    const shuffleCount = (syllabus?.shuffles ?? []).length;
    const courseCount = (syllabus?.courseIds ?? []).length;
    const linkCount = courseCount + (syllabus?.leadInstructorIds ?? []).length;

    const editHandler = useCallback(
        () => openSyllabusDialog(syllabusId),
        [ syllabusId, openSyllabusDialog ],
    );

    return (
        <CardActions { ...props }>
            <Button
                onClick={ editHandler }
                size="small"
                startIcon={ <EditIcon fontSize="small" /> }
            >
                עריכת סילבוס
            </Button>
            <Stack direction="row" gap={ 0.5 } sx={ { marginInlineStart: "auto" } }>
                <Tooltip title="שאפלים במקצוע">
                    <Chip
                        icon={ <GroupsIcon fontSize="small" /> }
                        label={ shuffleCount }
                        size="small"
                        variant="outlined"
                    />
                </Tooltip>
                <Tooltip
                    title={
                        courseCount === 0
                            ? "אין מסלול משויך — מומלץ לשייך לפחות מסלול אחד"
                            : "מסלולים ואחראי מקצוע"
                    }
                >
                    <Chip
                        color={ courseCount === 0 ? "warning" : "default" }
                        icon={ <LabelIcon fontSize="small" /> }
                        label={ linkCount }
                        size="small"
                        variant="outlined"
                    />
                </Tooltip>
            </Stack>
        </CardActions>
    );
}
