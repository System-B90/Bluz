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
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useCallback } from "react";

import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Event, PrayerEvent } from "@/components/schedule/types/event";
import ModuleField from '@/components/schedule/event-dialog/module-field';
import PrayerTypeField from '@/components/schedule/event-dialog/prayer-type';
import CourseField from '@/components/schedule/event-dialog/course-field';

interface EventDialogProps
{
    open: boolean;
    event: Partial<Event>;
    onClose: () => void;
    onSave: (event: Partial<Event>) => void;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
    onDelete: (eventId: Event[ 'id' ]) => void;
}

export default function EventDialog({
    open,
    event,
    onClose,
    onSave,
    onDelete,
    onEventChange,
}: EventDialogProps)
{
    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
        onSave(event);
    }, [ onSave, event ]);

    const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onEventChange({ name: e.target.value });
    }, [ onEventChange ]);

    const handleNotesChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onEventChange({ notes: e.target.value });
    }, [ onEventChange ]);

    const handleLockedChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onEventChange({ locked: e.target.checked });
    }, [ onEventChange ]);

    const handleRequiredChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onEventChange({ required: e.target.checked });
    }, [ onEventChange ]);

    const handlePersonalTalkChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        onEventChange({ personalTalk: e.target.checked });
    }, [ onEventChange ]);


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
                                value={ event?.name || "" }
                                onChange={ handleNameChange }
                                sx={ { flexGrow: 1 } }
                            />
                            <EventTimeField
                                sx={ { flexShrink: 1 } }
                                event={ event }
                                onEventChange={ onEventChange }
                            />
                        </Box>
                        <Box display={ 'flex' } width={ '100%' } gap={ 2 } justifyContent={ 'flex-start' }>
                            <EventTypeField
                                event={ event }
                                onEventChange={ onEventChange }
                                sx={ { width: '12.5%' } }
                            />
                            { event?.type === 'prayer' &&
                                <PrayerTypeField
                                    event={ event as PrayerEvent }
                                    onEventChange={ onEventChange }
                                    sx={ { width: '25%' } }
                                /> || <>
                                    <SubjectField
                                        event={ event }
                                        onEventChange={ onEventChange }
                                        sx={ { width: '25%' } }
                                    />
                                    <ModuleField
                                        event={ event }
                                        onEventChange={ onEventChange }
                                        sx={ { width: '20%' } }
                                    />
                                </> }
                            <CourseField
                                event={ event }
                                onEventChange={ onEventChange }
                                sx={ { flexGrow: 1 } }
                            />
                            <RoomField
                                event={ event }
                                onEventChange={ onEventChange }
                                sx={ { flexGrow: 1 } }
                            />
                        </Box>
                        <InstructorsField
                            event={ event }
                            onEventChange={ onEventChange }
                        />

                        <TextField
                            label="הערות"
                            fullWidth
                            multiline
                            rows={ 3 }
                            value={ event?.notes || "" }
                            onChange={ handleNotesChange }
                        />

                        <FormControlLabel
                            label="מתואם"
                            control={
                                <Switch
                                    checked={ event?.locked || false }
                                    onChange={ handleLockedChange }
                                />
                            }
                        />

                        <FormControlLabel
                            label="קריטי"
                            control={
                                <Switch
                                    checked={ event?.required || false }
                                    onChange={ handleRequiredChange }
                                />
                            }
                        />

                        <FormControlLabel
                            label='חלון פ"א'
                            control={
                                <Switch
                                    checked={ event?.personalTalk || false }
                                    onChange={ handlePersonalTalkChange }
                                />
                            }
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={ () => onDelete(event.id as string) } color='error' disabled={ !event?.id }>מחק</Button>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={ !event?.name }
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
