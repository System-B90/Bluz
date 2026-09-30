import AccountTreeIcon from "@mui/icons-material/AccountTree";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";

import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";

const styles = {
    chip: {
        flexShrink: 0,
        "& .MuiChip-icon": {
            marginInlineStart: 0.75,
            marginInlineEnd: -0.25,
        },
    },
} as const;

/**
 * Tags of the courses an event is limited to — the counterpart of the
 * shuffle chips for an event that only some of the syllabus' courses attend.
 */
export function CourseChips({ courseIds }: { courseIds: Array<CourseId> | null | undefined })
{
    const { getCourse } = useCourses();

    return (courseIds ?? []).map((courseId) => (
        <Tooltip key={ courseId } title="המופע למסלול זה בלבד">
            <Chip
                color="secondary"
                data-testid="event-course-chip"
                icon={ <AccountTreeIcon /> }
                label={ getCourse(courseId)?.name ?? "מסלול שנמחק" }
                size="small"
                sx={ styles.chip }
                variant="outlined"
            />
        </Tooltip>
    ));
}
