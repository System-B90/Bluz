'use client';

import
{
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Switch,
    TextField,
} from '@mui/material';
import { ChangeEvent, FormEvent, useCallback } from "react";

import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Period } from "@/components/schedule/types/event";

interface PeriodDialogProps
{
    open: boolean;
    period: Partial<Period>;
    onClose: () => void;
    onSave: (period: Partial<Period>) => void;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function PeriodDialog({
    open,
    period,
    onClose,
    onSave,
    onPeriodChange,
}: PeriodDialogProps)
{

    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
        onSave(period);
    }, [ onSave, period ]);

    const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onPeriodChange({ name: e.target.value });
    }, [ onPeriodChange ]);

    const handleNotesChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onPeriodChange({ notes: e.target.value });
    }, [ onPeriodChange ]);

    const handleLockedChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onPeriodChange({ locked: e.target.checked });
    }, [ onPeriodChange ]);

    const handleRequiredChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onPeriodChange({ required: e.target.checked });
    }, [ onPeriodChange ]);

    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="md" fullWidth>
            <DialogTitle>ערוך מופע</DialogTitle>

            <form onSubmit={ submitHandler }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <TextField
                            label="שם"
                            fullWidth
                            required
                            value={ period?.name || "" }
                            onChange={ handleNameChange }
                        />

                        <SubjectField
                            period={ period }
                            onPeriodChange={ onPeriodChange }
                        />
                        <EventTypeField
                            period={ period }
                            onPeriodChange={ onPeriodChange }
                        />
                        <EventTimeField
                            period={ period }
                            onPeriodChange={ onPeriodChange }
                        />
                        <RoomField
                            period={ period }
                            onPeriodChange={ onPeriodChange }
                        />
                        <InstructorsField
                            period={ period }
                            onPeriodChange={ onPeriodChange }
                        />

                        <TextField
                            label="הערות"
                            fullWidth
                            multiline
                            rows={ 3 }
                            value={ period?.notes || "" }
                            onChange={ handleNotesChange }
                        />

                        <FormControlLabel
                            label="מתואם"
                            control={
                                <Switch
                                    checked={ period?.locked || false }
                                    onChange={ handleLockedChange }
                                />
                            }
                        />

                        <FormControlLabel
                            label="קריטי"
                            control={
                                <Switch
                                    checked={ period?.required || false }
                                    onChange={ handleRequiredChange }
                                />
                            }
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={ !period?.name }
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
