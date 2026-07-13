"use client";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

/**
 * Editable list of free-text system requirements. Edits are buffered locally
 * and committed on blur / add / remove, mirroring the diff-on-blur pattern of
 * the rest of the dialog.
 */
export function SystemRequirementsField({
    requirements,
    onChange,
}: {
    requirements: Array<string>;
    onChange: (requirements: Array<string>) => void;
})
{
    const [ local, setLocal ] = useState<Array<string>>(requirements);

    // Keep local in sync when the underlying event changes (e.g. navigation).
    const [ prevRequirements, setPrevRequirements ] = useState(requirements);
    if (requirements !== prevRequirements)
    {
        setPrevRequirements(requirements);
        setLocal(requirements);
    }

    const commit = useCallback(
        (next: Array<string>) =>
        {
            const cleaned = next.map((r) => r.trim()).filter((r) => r.length > 0);
            // Avoid a write when nothing actually changed.
            if (
                cleaned.length === requirements.length &&
                cleaned.every((r, i) => r === requirements[ i ])
            )
            {
                return;
            }
            onChange(cleaned);
        },
        [ requirements, onChange ],
    );

    const handleEdit = useCallback((index: number, value: string) =>
    {
        setLocal((prev) => prev.map((r, i) => (i === index ? value : r)));
    }, []);

    const handleAdd = useCallback(() =>
    {
        setLocal((prev) => [ ...prev, "" ]);
    }, []);

    const handleRemove = useCallback(
        (index: number) =>
        {
            setLocal((prev) =>
            {
                const next = prev.filter((_, i) => i !== index);
                commit(next);
                return next;
            });
        },
        [ commit ],
    );

    return (
        <Stack spacing={ 1 }>
            { local.length === 0 && (
                <Typography color="text.secondary" variant="body2">
                    לא הוגדרו דרישות סיסטם.
                </Typography>
            ) }

            <Stack spacing={ 0.5 }>
                { local.map((req, index) => (
                    <Box
                        alignItems="center"
                        display="flex"
                        gap={ 1 }
                        key={ index }
                    >
                        <TextField
                            fullWidth
                            onBlur={ () => commit(local) }
                            onChange={ (e) => handleEdit(index, e.target.value) }
                            placeholder="דרישה..."
                            size="small"
                            value={ req }
                        />
                        <IconButton
                            color="error"
                            onClick={ () => handleRemove(index) }
                            size="small"
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )) }
            </Stack>

            <Button
                onClick={ handleAdd }
                size="small"
                startIcon={ <AddIcon /> }
                sx={ { alignSelf: "flex-start" } }
            >
                הוספת דרישה
            </Button>
        </Stack>
    );
}
