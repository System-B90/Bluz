import EditIcon from '@mui/icons-material/Edit';
import { Box, IconButton, Skeleton, TextField, Tooltip } from '@mui/material';
import { KeyboardEvent, ReactNode, useCallback, useState } from 'react';

export interface EditableCurriculumFieldProps
{
    value?: string;
    canEdit: boolean;
    editTooltip: string;
    skeletonWidth: number | string;
    multiline?: boolean;
    minRows?: number;
    allowEmpty: boolean;
    onSave: (nextValue: string) => Promise<void>;
    renderDisplay: (value: string) => ReactNode;
}

function EditableCurriculumFieldInner({
 value,
    canEdit,
    editTooltip,
    skeletonWidth,
    multiline = false,
    minRows,
    allowEmpty,
    onSave,
    renderDisplay
}: EditableCurriculumFieldProps)
{
    const [ localValue, setLocalValue ] = useState(value ?? '');
    const [ isEditing, setIsEditing ] = useState(false);

    const beginEditHandler = useCallback(() =>
    {
        if (!canEdit || value === undefined)
        {
            return;
        }
        setLocalValue(value);
        setIsEditing(true);
    }, [ canEdit, value ]);

    const saveHandler = useCallback(async () =>
    {
        if (!canEdit || value === undefined)
        {
            setIsEditing(false);
            return;
        }

        const trimmedValue = localValue.trim();
        if ((!allowEmpty && trimmedValue.length === 0) || trimmedValue === value)
        {
            setLocalValue(value);
            setIsEditing(false);
            return;
        }

        await onSave(trimmedValue);
        setIsEditing(false);
    }, [ allowEmpty, canEdit, localValue, onSave, value ]);

    const keyDownHandler = useCallback((event: KeyboardEvent<HTMLInputElement>) =>
    {
        if (event.key === 'Enter' && (!multiline || !event.shiftKey))
        {
            event.preventDefault();
            void saveHandler();
        }
        if (event.key === 'Escape')
        {
            setLocalValue(value ?? '');
            setIsEditing(false);
        }
    }, [ multiline, saveHandler, value ]);

    if (value === undefined)
    {
        return <Skeleton variant='text' width={ skeletonWidth } />;
    }

    if (isEditing)
    {
        return (
            <TextField
                autoFocus
                fullWidth
                minRows={ minRows }
                multiline={ multiline }
                onBlur={ () => void saveHandler() }
                onChange={ (e) => setLocalValue(e.target.value) }
                onKeyDown={ keyDownHandler }
                size="small"
                value={ localValue }
                variant="standard"
            />
        );
    }

    return (
        <Box alignItems={ multiline ? 'flex-start' : 'center' } display={ 'flex' } gap={ 1 }>
            <Box flexGrow={ 1 }>
                { renderDisplay(value) }
            </Box>
            <Tooltip title={ editTooltip }>
                <IconButton color="primary" onClick={ beginEditHandler } size="small">
                    <EditIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

export function EditableCurriculumField(props: EditableCurriculumFieldProps)
{
    return (<EditableCurriculumFieldInner key={ props.value ?? '-EditableCurriculumFieldInner-null' } { ...props } />);
}
