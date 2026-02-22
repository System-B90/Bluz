// Lot's of Gemini code in this file, quality may be inconsistent. Please review carefully.
import { Course } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/courses-provider";
import { Box, Button, ButtonGroup, Chip, InputBase, Tooltip, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import DeleteIcon from '@mui/icons-material/Delete';

function CourseItem({
    course,
    onUpdate,
    onDelete
}: {
    course: Course;
    onUpdate: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
})
{
    const [ title, setTitle ] = useState<string>(course.name);
    const [ isEditing, setIsEditing ] = useState<boolean>(false);

    useEffect(() =>
    {
        setTitle(course.name);
    }, [ course.name ]);

    const commitChange = useCallback(() =>
    {
        setIsEditing(false);
        if (title.trim() && title !== course.name)
        {
            onUpdate(course.id, title.trim());
        } else
        {
            setTitle(course.name); // Revert if empty or unchanged
        }
    }, [ title, course.name, course.id, onUpdate ]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key === 'Enter')
        {
            commitChange();
        } else if (event.key === 'Escape')
        {
            setIsEditing(false);
            setTitle(course.name); // Revert to original
        }
    }, [ commitChange, course.name ]);

    return (
        <Chip
            size="small"
            onDelete={ () => onDelete(course.id) }
            deleteIcon={ <Tooltip title="מחק מסלול"><DeleteIcon /></Tooltip> }
            label={
                isEditing ? (
                    <InputBase
                        value={ title }
                        onChange={ (e) => setTitle(e.target.value) }
                        onBlur={ commitChange }
                        onKeyDown={ handleKeyDown }
                        autoFocus
                        sx={ {
                            fontSize: 'inherit',
                            width: `${Math.max(title.length, 5)}ch`,
                            '& input': { padding: 0 }
                        } }
                    />
                ) : (
                    <Typography
                        onDoubleClick={ () => setIsEditing(true) }
                        sx={ { cursor: 'pointer' } }
                    >
                        { title }
                    </Typography>
                )
            }
        />
    );
}

export default function CourseSettings()
{
    const { courses, addCourse, updateCourse, deleteCourse } = useCourses();
    const originalCourses = useRef<Array<Course>>(courses);

    // Deep clone the initial courses to prevent mutating the provider's state
    const [ localCourses, setLocalCourses ] = useState<Array<Course>>(
        courses.map((c) => ({ ...c }))
    );

    const handleUpdateCourse = useCallback((id: string, newName: string) =>
    {
        setLocalCourses(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
    }, []);

    const handleDeleteCourse = useCallback((id: string) =>
    {
        setLocalCourses(prev => prev.filter(c => c.id !== id));
    }, []);

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
                return original && original.name !== course.name;
            })
            .map(course => updateCourse(course));

        await Promise.all([ ...deletePromises, ...addPromises, ...updatePromises ]);

        originalCourses.current = localCourses.map(c => ({ ...c }));
    }, [ localCourses, addCourse, updateCourse, deleteCourse ]);

    const handleRestore = useCallback(() =>
    {
        // Deep clone the baseline to reset the draft
        setLocalCourses(originalCourses.current.map(c => ({ ...c })));
    }, []);

    const handleCreate = useCallback(() =>
    {
        // Add to local draft state with a temporary ID. 
        // Note: Ensure your backend handles or ignores temporary IDs upon creation.
        const newCourse = {
            id: `temp-${Date.now()}`,
            name: 'מסלול חדש'
        } as Course;

        setLocalCourses(prev => [ ...prev, newCourse ]);
    }, []);

    const courseItems = localCourses.map(course => (
        <CourseItem
            key={ course.id }
            course={ course }
            onUpdate={ handleUpdateCourse }
            onDelete={ handleDeleteCourse }
        />
    ));

    return (
        <Box border={ 'solid 0.15rem rgba(0,0,0,0.2)' } padding={ '0.5rem' } borderRadius={ 3 } gap={ 1 } display={ 'flex' } flexDirection={ 'column' } justifyContent={ 'space-between' }>
            <Box>
                <Typography variant="h6" gutterBottom>מסלולים</Typography>
                <Box display={ 'flex' } flexDirection={ 'column' } gap={ 1 } alignItems="flex-start">
                    { courseItems }
                </Box>
            </Box>
            <Box display={ 'flex' } gap={ 1 } flexDirection={ 'column' } mt={ 2 }>
                <Button color={ 'secondary' } variant="contained" onClick={ handleCreate }>יצירת מסלול חדש</Button>
                <ButtonGroup fullWidth>
                    <Button color="primary" variant="contained" onClick={ handleSave }>שמירה</Button>
                    <Button color={ 'warning' } variant="contained" onClick={ handleRestore }>שחזור</Button>
                </ButtonGroup>
            </Box>
        </Box>
    );
}
