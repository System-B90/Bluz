import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
    Box,
    BoxProps,
    ChipProps,
    Tooltip,
} from "@mui/material";
import { useMemo } from "react";

import { Course, CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";

/** Lightweight tag — matching the person tag style. */
const tagSx = (color?: string) => ({
    display: "inline-flex",
    alignItems: "center",
    px: 0.6,
    py: 0.1,
    borderRadius: "4px",
    fontSize: "0.72rem",
    lineHeight: 1.4,
    fontWeight: 400,
    whiteSpace: "nowrap" as const,
    border: "1px solid",
    borderColor: "var(--event-border)",
    color: color ?? "inherit",
});

function SingleCourseTag({ course }: { course: Course }) {
    return (
        <Box
            component="span"
            sx={tagSx(course.color ?? undefined)}
        >
            {course.name}
        </Box>
    );
}

export function CourseComponent({
    courseIds,
    showCaption,
    chipSize: _chipSize,
    ...props
}: {
  courseIds: Array<CourseId>;
  showCaption?: boolean;
  chipSize?: ChipProps["size"];
} & BoxProps) {
    const { getCourse } = useCourses();
    const courses = useMemo(
        () => courseIds.map(getCourse).filter((v) => !!v),
        [courseIds, getCourse],
    );

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            flexWrap="wrap"
            gap={0.4}
            {...props}
        >
            {showCaption !== false && (
                <Tooltip title={courseIds.length === 1 ? "מסלול" : "מסלולים"}>
                    <MenuBookIcon
                        sx={{ fontSize: "0.85rem", opacity: 0.6 }}
                    />
                </Tooltip>
            )}
            {courses.map((course) => (
                <SingleCourseTag course={course} key={course.id} />
            ))}
        </Box>
    );
}
