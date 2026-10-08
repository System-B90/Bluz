import EditIcon from "@mui/icons-material/Edit";
import GroupsIcon from "@mui/icons-material/Groups";
import LabelIcon from "@mui/icons-material/Label";
import Button from "@mui/material/Button";
import CardActions, { CardActionsProps } from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useCallback, useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { formatHours } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { useHoursFormat } from "@/components/gantt/curriculum-view/use-hours-format";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { doShuffleTotalsDiffer, getSyllabusShuffleTotals } from "@/components/gantt/utils";

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
}: SyllabusCardActionsProps) {
    const { openSyllabusDialog } = useCurriculumProviderActions();
    const syllabus = useSyllabus(syllabusId);
    const shuffles = syllabus?.shuffles ?? [];
    const shuffleCount = shuffles.length;
    const state = useCurriculumState();
    useHoursFormat();
    // Every shuffle must get the same time in the syllabus; its modules may
    // split it differently. Course-limited events are outside the comparison.
    const shuffleTotals = useMemo(
        () =>
            syllabus
                ? getSyllabusShuffleTotals(syllabus, "minimumDuration", state)
                : null,
        [syllabus, state],
    );
    const shufflesDiffer = doShuffleTotalsDiffer(shuffleTotals);
    const courseCount = (syllabus?.courseIds ?? []).length;
    const linkCount = courseCount + (syllabus?.leadInstructorIds ?? []).length;
    const { getCourse } = useCourses();
    const { getInstructor } = useHiveUsers();
    const courseNames = (syllabus?.courseIds ?? [])
        .map((id) => getCourse(id)?.name)
        .filter((name): name is string => Boolean(name));
    const leadNames = (syllabus?.leadInstructorIds ?? []).map(
        (id) => getInstructor(id)?.display_name ?? String(id),
    );

    const editHandler = useCallback(
        () => openSyllabusDialog(syllabusId),
        [syllabusId, openSyllabusDialog],
    );

    return (
        <CardActions {...props}>
            <Button
                onClick={editHandler}
                size="small"
                startIcon={<EditIcon fontSize="small" />}
            >
                עריכת סילבוס
            </Button>
            <Stack
                direction="row"
                gap={0.5}
                sx={{
                    marginInlineStart: "auto",
                    "& .MuiChip-root .MuiChip-icon": {
                        marginInlineEnd: -0.25,
                        marginInlineStart: 0.75,
                    },
                }}
            >
                <Tooltip
                    title={
                        shuffles.length > 0 ? (
                            <>
                                {shuffleTotals ? (
                                    <div>
                                        {shufflesDiffer
                                            ? "לשאפלים זמן נדרש שונה:"
                                            : "לכל השאפלים זמן נדרש זהה:"}
                                    </div>
                                ) : null}
                                {shuffles.map((name) => {
                                    const description =
                                        syllabus?.shuffleDescriptions?.[name];
                                    const minutes = shuffleTotals?.[name];
                                    return (
                                        <div key={name}>
                                            {name}
                                            {minutes !== undefined
                                                ? ` · ${formatHours(minutes)}`
                                                : ""}
                                            {description ? ` — ${description}` : ""}
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            "אין שאפלים בסילבוס"
                        )
                    }
                >
                    <Chip
                        color={shufflesDiffer ? "warning" : "default"}
                        data-testid="syllabus-shuffles-chip"
                        icon={<GroupsIcon fontSize="small" />}
                        label={shuffleCount}
                        size="small"
                        variant="outlined"
                    />
                </Tooltip>
                <Tooltip
                    title={
                        <>
                            <div>
                                {"מסלולים: "}
                                {courseNames.length > 0
                                    ? courseNames.join(", ")
                                    : "אין מסלול משויך — מומלץ לשייך לפחות מסלול אחד"}
                            </div>
                            <div>
                                {"אחראי מקצוע: "}
                                {leadNames.length > 0
                                    ? leadNames.join(", ")
                                    : "אין"}
                            </div>
                        </>
                    }
                >
                    <Chip
                        color={courseCount === 0 ? "warning" : "default"}
                        icon={<LabelIcon fontSize="small" />}
                        label={linkCount}
                        size="small"
                        variant="outlined"
                    />
                </Tooltip>
            </Stack>
        </CardActions>
    );
}
