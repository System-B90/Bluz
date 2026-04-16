// Lot's of Gemini code in this file, quality may be inconsistent. Please review carefully.
import DeleteIcon from '@mui/icons-material/Delete';
import { Box, Chip, InputBase, Tooltip, Typography } from "@mui/material";
import { MuiColorInput, MuiColorInputColors, MuiColorInputProps } from 'mui-color-input';
import { useCallback, useState } from "react";

import { Color } from "@/api-shared/common";
import { Course } from "@/api-shared/types/course";

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
                            p: 0,
m: 0,
width: '1rem',
height: '1rem',
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
