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
    FormGroup,
    Switch,
    TextField,
} from '@mui/material';
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useCallback } from "react";

import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Period, PrayerEvent } from "@/components/schedule/types/event";
import ModuleField from '@/components/schedule/event-dialog/module-field';
import PrayerEventComponent from '@/components/schedule/event-component/variants/prayer-event';
import PrayerTypeField from '@/components/schedule/event-dialog/prayer-type';

interface PeriodDialogProps
{
    open: boolean;
    period: Partial<Period>;
    onClose: () => void;
    onSave: (period: Partial<Period>) => void;
    onPeriodChange: Dispatch<SetStateAction<Partial<Period>>>;
    onDelete: (periodId: Period[ 'id' ]) => void;
}

export default function PeriodDialog({
    open,
    period,
    onClose,
    onSave,
    onDelete,
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

    const handlePersonalTalkChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onPeriodChange({ personalTalk: e.target.checked });
    }, [ onPeriodChange ]);


    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="md" fullWidth>
            <DialogTitle>ערוך מופע</DialogTitle>

            <form onSubmit={ submitHandler }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <Box gap={ 2 } display={ 'flex' } width={ '100%' }>
                            <TextField
                                label="שם"
                                fullWidth
                                required
                                value={ period?.name || "" }
                                onChange={ handleNameChange }
                                sx={ { flexGrow: 1 } }
                            />
                            <EventTimeField
                                sx={ { flexShrink: 1 } }
                                period={ period }
                                onPeriodChange={ onPeriodChange }
                            />
                        </Box>
                        <Box display={ 'flex' } width={ '100%' } gap={ 2 } justifyContent={ 'flex-start' }>
                            <EventTypeField
                                period={ period }
                                onPeriodChange={ onPeriodChange }
                                sx={ { width: '12.5%' } }
                            />
                            { period?.type === 'prayer' &&
                                <PrayerTypeField
                                    period={ period as PrayerEvent }
                                    onPeriodChange={ onPeriodChange }
                                    sx={ { width: '25%' } }
                                /> || <>
                                    <SubjectField
                                        period={ period }
                                        onPeriodChange={ onPeriodChange }
                                        sx={ { width: '25%' } }
                                    />
                                    <ModuleField
                                        period={ period }
                                        onPeriodChange={ onPeriodChange }
                                        sx={ { width: '20%' } }
                                    />
                                </> }
                            <RoomField
                                period={ period }
                                onPeriodChange={ onPeriodChange }
                                sx={ { flexGrow: 1 } }
                            />
                        </Box>
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

                        <FormControlLabel
                            label='חלון פ"א'
                            control={
                                <Switch
                                    checked={ period?.personalTalk || false }
                                    onChange={ handlePersonalTalkChange }
                                />
                            }
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={ () => onDelete(period.id as string) } color='error' disabled={ !period?.id }>מחק</Button>
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
