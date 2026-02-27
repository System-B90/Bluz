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
import { FormEvent, useCallback, useState, useEffect, ChangeEvent } from "react";

import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Event, EventId, PrayerEvent } from "@/components/schedule/types/event";
import ModuleField from '@/components/schedule/event-dialog/module-field';
import PrayerTypeField from '@/components/schedule/event-dialog/prayer-type';
import CourseField from '@/components/schedule/event-dialog/course-field';

interface EventDialogProps
{
    open: boolean;
    event: Event;
    onClose: () => void;
    onSave: (event: Event) => void;
    onDelete: (eventId: EventId) => void;
}

export default function EventDialog({
    open,
    event: inputEvent,
    onClose,
    onSave,
    onDelete,
}: EventDialogProps)
{
    const [ event, setEventRaw ] = useState<Event>({ ...inputEvent });

    // Sync state when dialog opens with a new event
    useEffect(() =>
    {
        if (open)
        {
            setEventRaw({ ...inputEvent });
        }
    }, [ inputEvent, open ]);

    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
        onSave({ ...event });
    }, [ event, onSave ]);

    const setEvent = useCallback((update: Partial<Event>) =>
    {
        setEventRaw((prev) => ({ ...prev, ...update }));
    }, []);

    // Replaced the ref with standard state-driven controlled input logic
    const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        setEvent({ name: e.target.value });
    }, [ setEvent ]);

    const handleNotesChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    {
        setEvent({ notes: e.target.value });
    }, [ setEvent ]);

    const handleLockedChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        setEvent({ locked: e.target.checked });
    }, [ setEvent ]);

    const handleRequiredChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        setEvent({ required: e.target.checked });
    }, [ setEvent ]);

    const handlePersonalTalkChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        setEvent({ personalTalk: e.target.checked });
    }, [ setEvent ]);

    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="lg" fullWidth>
            <DialogTitle>ערוך מופע</DialogTitle>

            <form onSubmit={ submitHandler }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <Box gap={ 2 } display={ 'flex' } width={ '100%' }>
                            <TextField
                                label="שם"
                                fullWidth
                                required
                                value={ event.name ?? '' } // Prevents controlled/uncontrolled warning
                                onChange={ handleNameChange }
                                sx={ { flexGrow: 1 } }
                            />
                            <EventTimeField
                                sx={ { flexShrink: 1 } }
                                event={ event }
                                onBlurCallback={ setEvent }
                            />
                        </Box>

                        <Box display={ 'flex' } width={ '100%' } gap={ 2 } justifyContent={ 'flex-start' }>
                            <EventTypeField
                                event={ event }
                                onBlurCallback={ setEvent }
                                sx={ { width: '12.5%' } }
                            />

                            {/* Standardized JSX Ternary */ }
                            { event?.type === 'prayer' ? (
                                <PrayerTypeField
                                    event={ event as PrayerEvent }
                                    onEventChange={ setEvent }
                                    sx={ { width: '25%' } }
                                />
                            ) : (
                                <>
                                    <SubjectField
                                        event={ event }
                                        onEventChange={ setEvent }
                                        sx={ { width: '18%' } }
                                    />
                                    <ModuleField
                                        event={ event }
                                        onEventChange={ setEvent }
                                        sx={ { width: '17%' } }
                                    />
                                </>
                            ) }

                            <Box gap={ 'inherit' } display={ 'flex' } flexGrow={ 1 }>
                                <CourseField
                                    event={ event }
                                    onBlurCallback={ setEvent }
                                    fullWidth
                                />
                                <RoomField
                                    event={ event }
                                    onBlurCallback={ setEvent }
                                    fullWidth
                                />
                            </Box>
                        </Box>

                        <InstructorsField
                            event={ event }
                            onBlurCallback={ setEvent }
                        />

                        <TextField
                            label="הערות"
                            fullWidth
                            multiline
                            rows={ 3 }
                            value={ event.notes ?? '' }
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
                        // Fixed logic: Disable if name is empty or undefined
                        disabled={ !event?.name || event.name.length === 0 }
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
} 