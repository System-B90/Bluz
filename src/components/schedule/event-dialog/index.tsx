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
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useCallback, useState, useEffect, useRef } from "react";

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
    event: Partial<Event>;
    onClose: () => void;
    onSave: (event: Partial<Event>) => void;
    onEventChange: Dispatch<SetStateAction<Partial<Event>>>;
    onDelete: (eventId: EventId) => void;
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

    // --- OPTIMIZATION: Local state to prevent typing lag ---
    const [ localName, setLocalName ] = useState(event?.name || "");
    const [ localNotes, setLocalNotes ] = useState(event?.notes || "");

    const nameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync local state if the event prop changes externally (e.g. opening a different event)
    useEffect(() =>
    {
        setLocalName(event?.name || "");
    }, [ event?.name ]);

    useEffect(() =>
    {
        setLocalNotes(event?.notes || "");
    }, [ event?.notes ]);

    // Cleanup timeouts to prevent memory leaks if the dialog closes while typing
    useEffect(() =>
    {
        return () =>
        {
            if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
            if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
        };
    }, []);
    // --------------------------------------------------------

    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
        // Guarantee we pass the latest typed values even if the debounce hasn't flushed yet
        onSave({ ...event, name: localName, notes: localNotes });
    }, [ onSave, event, localName, localNotes ]);

    const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        const val = e.target.value;
        setLocalName(val); // UI updates instantly

        if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
        nameTimeoutRef.current = setTimeout(() =>
        {
            onEventChange({ name: val }); // Parent syncs smoothly in the background
        }, 300);
    }, [ onEventChange ]);

    const handleNotesChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
    {
        const val = e.target.value;
        setLocalNotes(val); // UI updates instantly

        if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
        notesTimeoutRef.current = setTimeout(() =>
        {
            onEventChange({ notes: val }); // Parent syncs smoothly in the background
        }, 300);
    }, [ onEventChange ]);

    // Switches and isolated non-typing fields can safely remain synchronous
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
                                value={ localName } // Use local state here
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
                                        sx={ { width: '18%' } }
                                    />
                                    <ModuleField
                                        event={ event }
                                        onEventChange={ onEventChange }
                                        sx={ { width: '17%' } }
                                    />
                                </> }
                            <Box
                                gap={ 'inherit' }
                                display={ 'flex' }
                                flexGrow={ 1 }>
                                <CourseField
                                    event={ event }
                                    onEventChange={ onEventChange }
                                    fullWidth
                                />
                                <RoomField
                                    event={ event }
                                    onEventChange={ onEventChange }
                                    fullWidth
                                />
                            </Box>
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
                            value={ localNotes } // Use local state here
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
                        disabled={ !localName } // Rely on local state validation here
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
