'use client';

import CourseField from '@/components/schedule/event-dialog/course-field';
import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import ModuleField from '@/components/schedule/event-dialog/module-field';
import PrayerTypeField from '@/components/schedule/event-dialog/prayer-type';
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Event, EventId, PrayerEvent } from "@/components/schedule/types/event";
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
import { FormEvent, useCallback, useEffect, useState } from "react";

interface EventDialogProps
{
    open: boolean;
    event: Event;
    onClose: () => void;
    onSave: (event: Event) => void;
    onDelete: (eventId: EventId) => void;
}
const EventPrimaryDetails = ({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
}) => (
    <>
        <Box gap={ 2 } display="flex" width="100%">
            <TextField
                label="שם"
                fullWidth
                required
                value={ event.name ?? '' }
                onChange={ (e) => onUpdate({ name: e.target.value }) }
                sx={ { flexGrow: 1 } }
            />
            <EventTimeField
                sx={ { flexShrink: 1 } }
                event={ event }
                onBlurCallback={ onUpdate }
            />
        </Box>

        <TextField
            label="הערות"
            fullWidth
            multiline
            rows={ 3 }
            value={ event.notes ?? '' }
            onChange={ (e) => onUpdate({ notes: e.target.value }) }
        />
    </>
);

const EventClassification = ({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
}) => (
    <Box display="flex" width="100%" gap={ 2 } justifyContent="flex-start">
        <EventTypeField
            event={ event }
            onBlurCallback={ onUpdate }
            sx={ { width: '12.5%' } }
        />

        { event?.type === 'prayer' ? (
            <PrayerTypeField
                event={ event as PrayerEvent }
                onEventChange={ onUpdate }
                sx={ { width: '25%' } }
            />
        ) : (
            <>
                <SubjectField
                    event={ event }
                    onEventChange={ onUpdate }
                    sx={ { width: '18%' } }
                />
                <ModuleField
                    event={ event }
                    onEventChange={ onUpdate }
                    sx={ { width: '17%' } }
                />
            </>
        ) }

        <Box gap="inherit" display="flex" flexGrow={ 1 }>
            <CourseField
                event={ event }
                onBlurCallback={ onUpdate }
                fullWidth
            />
            <RoomField
                event={ event }
                onBlurCallback={ onUpdate }
                fullWidth
            />
        </Box>
    </Box>
);

const EventToggles = ({ event, onUpdate }: {
    event: Event,
    onUpdate: (u: Partial<Event>) => void;
}) =>
{
    const toggles = [
        { label: 'מתואם', key: 'locked' },
        { label: 'קריטי', key: 'required' },
        { label: 'חלון פ"א', key: 'personalTalk' },
    ] as const;

    return (
        <Box display="flex" gap={ 2 }>
            { toggles.map(({ label, key }) => (
                <FormControlLabel
                    key={ key }
                    label={ label }
                    control={
                        <Switch
                            checked={ !!event[ key ] }
                            onChange={ (e) => onUpdate({ [ key ]: e.target.checked }) }
                        />
                    }
                />
            )) }
        </Box>
    );
};

export default function EventDialog({
    open,
    event: inputEvent,
    onClose,
    onSave,
    onDelete,
}: EventDialogProps)
{
    const [ event, setEventRaw ] = useState<Event>({ ...inputEvent });
    const [ prevOpen, setPrevOpen ] = useState(open);
    const [ prevInputEvent, setPrevInputEvent ] = useState(inputEvent);

    if (open !== prevOpen || inputEvent !== prevInputEvent)
    {
        setPrevOpen(open);
        setPrevInputEvent(inputEvent);
        if (open)
        {
            setEventRaw({ ...inputEvent });
        }
    }

    const handleUpdate = useCallback((update: Partial<Event>) =>
    {
        setEventRaw((prev) => ({ ...prev, ...update }));
    }, []);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
        onSave(event);
    };

    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="lg" fullWidth>
            <DialogTitle>ערוך מופע</DialogTitle>

            <form onSubmit={ handleSubmit }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 3, mt: 1 } }>
                        <EventPrimaryDetails event={ event } onUpdate={ handleUpdate } />

                        <EventClassification event={ event } onUpdate={ handleUpdate } />

                        <InstructorsField
                            event={ event }
                            onBlurCallback={ handleUpdate }
                        />

                        <EventToggles event={ event } onUpdate={ handleUpdate } />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={ () => onDelete(event.id as string) }
                        color="error"
                        disabled={ !event?.id }
                    >
                        מחק
                    </Button>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={ !event?.name?.trim() }
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
