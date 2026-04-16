'use client';

import
    {
        Box,
        Button,
        Dialog,
        DialogActions,
        DialogContent,
        DialogTitle,
    } from '@mui/material';
import { FormEvent, useCallback, useState } from "react";

import { EventClassification } from '@/components/schedule/event-dialog/EventClassification';
import { EventPrimaryDetails } from '@/components/schedule/event-dialog/EventPrimaryDetails';
import { EventToggles } from '@/components/schedule/event-dialog/EventToggles';
import InstructorsField from "@/components/schedule/event-dialog/InstructorsField";
import { Event, EventId } from "@/components/schedule/types/event";

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
        <Dialog fullWidth maxWidth="lg" onClose={ onClose } open={ open }>
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
                        color="error"
                        disabled={ !event?.id }
                        onClick={ () => onDelete(event.id as string) }
                    >
                        מחק
                    </Button>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button
                        disabled={ !event?.name?.trim() }
                        type="submit"
                        variant="contained"
                    >
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
