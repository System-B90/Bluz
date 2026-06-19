import MenuBookIcon from "@mui/icons-material/MenuBook";
import Box, { BoxProps } from "@mui/material/Box";
import { ChipProps } from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { Course, CourseId } from "@/api-shared/types/course";
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
                    <MenuBookIcon sx={{ fontSize: "0.85rem", opacity: 0.6 }} />
                </Tooltip>
            )}
            {courses.map((course) => (
                <SingleCourseTag course={course} key={course.id} />
            ))}
        </Box>
    );
}
