import { Course, CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/courses-provider";
import { Box, BoxProps, Chip, ChipProps, Stack, Typography } from "@mui/material";
import { useMemo } from "react";

function SingleCourseComponent({ course, size, ...props }: { course: Course; } & ChipProps)
{
    return (
        <Chip
            size={ size ?? 'small' }
            { ...props }
            label={ course.name }
            sx={ { color: course.color ?? 'inherit' } }
        />
    );
}

export function CourseComponent({ courseIds, showCaption, chipSize, ...props }: { courseIds: Array<CourseId>; showCaption?: boolean; chipSize?: ChipProps[ 'size' ]; } & BoxProps)
{
    const { getCourse } = useCourses();
    const courses = useMemo(() => courseIds.map(getCourse).filter((v) => !!v), [ courseIds, getCourse ]);

    return (
        <Box display={ props.display ?? "flex" } flexDirection={ props.flexDirection ?? 'column' } alignItems={ props.alignItems ?? "flex-start" } gap={ 0.2 } { ...props }>
            { (showCaption !== false) && <Typography variant="caption" fontWeight={ 600 } noWrap>{ courseIds.length === 1 ? 'מסלול' : 'מסלולים' }</Typography> }
            < Stack display={ 'flex' } flexDirection={ props.flexDirection ?? 'row' } gap={ 0.3 } flexWrap="wrap">
                { courses.map((course) => <SingleCourseComponent key={ course.id } course={ course } size={ chipSize } />) }
            </Stack>
        </Box >
    );
}
export default CourseComponent;
