// Lot's of Gemini code in this file, quality may be inconsistent. Please review carefully.
import { Course } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/courses-provider";
import { Box, Button, ButtonGroup, Chip, InputBase, Tooltip, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import DeleteIcon from '@mui/icons-material/Delete';
import { Color } from "@/api-shared/common";
import { MuiColorInput, MuiColorInputColors, MuiColorInputProps } from 'mui-color-input';

export function CourseItem({
    course,
    onUpdate,
    onDelete
}: {
    course: Course;
    onUpdate: (id: string, { newName, newColor }: { newName?: string; newColor?: Color | null; }) => void;
    onDelete: (id: string) => void;
})
{
    const [ title, setTitle ] = useState<string>(course.name);
    const [ color, setColor ] = useState<Color | null>(course.color);
    const [ isEditing, setIsEditing ] = useState<boolean>(false);

    const commitTitleChange = useCallback(() =>
    {
        setIsEditing(false);
        if (title.trim() && title !== course.name)
        {
            onUpdate(course.id, { newName: title.trim() });
        } else
        {
            setTitle(course.name);
        }
    }, [ title, course.name, course.id, onUpdate ]);

    const commitColorChange = useCallback((newColor: Color) =>
    {
        if (newColor !== course.color)
        {
            onUpdate(course.id, { newColor });
        }
        // No need to manually reset state here; if the update fails or changes, 
        // the parent will eventually trigger a remount if the key changes.
    }, [ course.color, course.id, onUpdate ]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key === 'Enter')
        {
            commitTitleChange();
        } else if (event.key === 'Escape')
        {
            setIsEditing(false);
            setTitle(course.name);
        }
    }, [ commitTitleChange, course.name ]);

    const handleColorChange: MuiColorInputProps[ 'onChange' ] = useCallback((_value: string, colors: MuiColorInputColors) =>
    {
        const hex = colors.hex as Color;
        setColor(hex);
        commitColorChange(hex);
    }, [ commitColorChange ]);

    return (
        <Chip
            size="small"
            onDelete={ () => onDelete(course.id) }
            deleteIcon={ <Tooltip title="מחק מסלול"><DeleteIcon /></Tooltip> }
            label={
                <Box display={ 'flex' } flexDirection={ 'row' } alignItems={ 'center' } gap={ 0.5 }>
                    <MuiColorInput
                        size={ 'small' }
                        dir="ltr"
                        value={ color ?? '#e0e0e0' }
                        onChange={ handleColorChange }
                        format="hex"
                        isAlphaHidden
                        fullWidth={ false }
                        sx={ {
                            p: 0, m: 0, width: '1rem', height: '1rem',
                            '& .MuiInputBase-root': { padding: 0, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }
                        } }
                    />
                    { isEditing ? (
                        <InputBase
                            value={ title }
                            onChange={ (e) => setTitle(e.target.value) }
                            onBlur={ commitTitleChange }
                            onKeyDown={ handleKeyDown }
                            autoFocus
                            sx={ { fontSize: 'inherit', width: `${Math.max(title.length, 5)}ch` } }
                        />
                    ) : (
                        <Typography
                            onDoubleClick={ () => setIsEditing(true) }
                            sx={ { cursor: 'pointer', userSelect: 'none' } }
                        >
                            { title }
                        </Typography>
                    ) }
                </Box>
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
            key={ `${course.id}-${course.color}-${course.name}` }
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
