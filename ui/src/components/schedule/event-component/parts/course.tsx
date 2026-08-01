import MenuBookIcon from "@mui/icons-material/MenuBook";
import Box, { BoxProps } from "@mui/material/Box";
import { ChipProps } from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { Course, CourseId } from "@/api-shared/types/course";
import { collapseCourseSelection } from "@/components/base/collapse-course-selection";
import { useCourses } from "@/components/base/CoursesProvider";
import { tagSx } from "@/components/schedule/event-component/parts/tag-sx";

function SingleCourseTag({ course }: { course: Course }) {
    return (
        <Box component="span" sx={tagSx({ customColor: course.color ?? undefined })}>
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
    const { courses: allCourses } = useCourses();
    const courses = useMemo(
        () => collapseCourseSelection(courseIds, allCourses),
        [courseIds, allCourses],
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
                <Tooltip title={courses.length === 1 ? "מסלול" : "מסלולים"}>
                    <MenuBookIcon sx={{ fontSize: "0.85rem", opacity: 0.6 }} />
                </Tooltip>
            )}
            {courses.map((course) => (
                <SingleCourseTag course={course} key={course.id} />
            ))}
        </Box>
    );
}
