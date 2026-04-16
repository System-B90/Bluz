import { Box, Button, ButtonGroup, Typography } from "@mui/material";
import { useCallback, useRef, useState } from "react";

import { Color } from "@/api-shared/common";
import { Course } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import { CourseItem } from "@/components/settings-dialog/tabs/global/course-settings/CourseItem";

export default function CourseSettings()
{
    const { courses, addCourse, updateCourse, deleteCourse } = useCourses();
    const originalCourses = useRef<Array<Course>>(courses);

    // Deep clone the initial courses to prevent mutating the provider's state
    const [ localCourses, setLocalCourses ] = useState<Array<Course>>(
        courses.map((c) => ({ ...c }))
    );

    const handleUpdateCourse = useCallback((id: string, { newName, newColor }: { newName?: string; newColor?: Color | null; }) =>
    {
        setLocalCourses(prev => prev.map(c => c.id === id ? { ...c, name: (newName ?? c.name), color: (newColor ?? c.color), } : c));
    }, [ setLocalCourses ]);

    const handleDeleteCourse = useCallback((id: string) =>
    {
        setLocalCourses(prev => prev.filter(c => c.id !== id));
    }, [ setLocalCourses ]);

    const handleSave = useCallback(async () =>
    {
        const baseline = originalCourses.current;

        const deletePromises = baseline
            .filter(course => !localCourses.find(c => c.id === course.id))
            .map(course => deleteCourse(course.id));

        const addPromises = localCourses
            .filter(course => !baseline.find(c => c.id === course.id))
            .map(course => addCourse(course));

        const updatePromises = localCourses
            .filter(course =>
            {
                const original = baseline.find(c => c.id === course.id);
                return original && (original.name !== course.name || original.color !== course.color);
            })
            .map(course => updateCourse(course));

        await Promise.all([ ...deletePromises, ...addPromises, ...updatePromises ]);

        originalCourses.current = localCourses.map(c => ({ ...c }));
    }, [ localCourses, addCourse, updateCourse, deleteCourse ]);

    const handleRestore = useCallback(() =>
    {
        // Deep clone the baseline to reset the draft
        setLocalCourses(originalCourses.current.map(c => ({ ...c })));
    }, [ setLocalCourses ]);

    const handleCreate = useCallback(() =>
    {
        // Add to local draft state with a temporary ID. 
        // Note: Ensure your backend handles or ignores temporary IDs upon creation.
        const newCourse = {
            id: `temp-${Date.now()}`,
            name: 'מסלול חדש',
            color: null,
        } as Course;

        setLocalCourses(prev => [ ...prev, newCourse ]);
    }, [ setLocalCourses ]);

    const courseItems = localCourses.map(course => (
        <CourseItem
            course={ course }
            key={ `${course.id}-${course.color}-${course.name}` }
            onDelete={ handleDeleteCourse }
            onUpdate={ handleUpdateCourse }
        />
    ));

    return (
        <Box border={ 'solid 0.15rem rgba(0,0,0,0.2)' } borderRadius={ 3 } display={ 'flex' } flexDirection={ 'column' } gap={ 1 } justifyContent={ 'space-between' } padding={ '0.5rem' }>
            <Box>
                <Typography gutterBottom variant="h6">מסלולים</Typography>
                <Box alignItems={ 'flex-start' } display={ 'flex' } flexDirection={ 'column' } gap={ 1 }>
                    { courseItems }
                </Box>
            </Box>
            <Box display={ 'flex' } flexDirection={ 'column' } gap={ 1 } mt={ 2 }>
                <Button color={ 'secondary' } onClick={ handleCreate } variant="contained">יצירת מסלול חדש</Button>
                <ButtonGroup fullWidth>
                    <Button color="primary" onClick={ handleSave } variant="contained">שמירה</Button>
                    <Button color={ 'warning' } onClick={ handleRestore } variant="contained">שחזור</Button>
                </ButtonGroup>
            </Box>
        </Box>
    );
}
