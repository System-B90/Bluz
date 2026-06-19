"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { FormEvent, useCallback, useState } from "react";

import { EventClassification } from "@/components/schedule/event-dialog/EventClassification";
import { EventPrimaryDetails } from "@/components/schedule/event-dialog/EventPrimaryDetails";
import { EventToggles } from "@/components/schedule/event-dialog/EventToggles";
import { InstructorsField } from "@/components/schedule/event-dialog/InstructorsField";
import { Event, EventId } from "@/components/schedule/types/event";

type EventOrPartial = Event | Omit<Event, "id"> | Partial<Event>;
type EventDialogProps = {
    open: boolean;
    event: EventOrPartial;
    // Display name of another user currently editing this event, if any.
    lockedByName?: string;
    onClose: () => void;
    onSave: (event: EventOrPartial) => void;
    onDelete: (eventId: EventId) => void;
};

export function EventDialog({
    open,
    event: inputEvent,
    lockedByName,
    onClose,
    onSave,
    onDelete,
}: EventDialogProps) {
    const [event, setEventRaw] = useState<EventOrPartial>({ ...inputEvent });
    const [prevOpen, setPrevOpen] = useState(open);
    const [prevInputEvent, setPrevInputEvent] = useState(inputEvent);

    if (open !== prevOpen || inputEvent !== prevInputEvent) {
        setPrevOpen(open);
        setPrevInputEvent(inputEvent);
        if (open) {
            setEventRaw({ ...inputEvent });
        }
    }

    const handleUpdate = useCallback((update: Partial<Event>) => {
        setEventRaw((prev) => ({ ...prev, ...update }));
    }, []);

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSave(event);
    };

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={onClose}
            open={open}
            PaperProps={{
                sx: {
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
            }}
        >
            <DialogTitle>ערוך מופע</DialogTitle>

            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            mt: 1,
                        }}
                    >
                        {lockedByName ? (
                            <Alert severity="warning" variant="outlined">
                                {`משתמש אחר (${lockedByName}) עורך כעת מופע זה. שמירה תדרוס את שינוייו.`}
                            </Alert>
                        ) : null}

                        <EventPrimaryDetails
                            event={event}
                            onUpdate={handleUpdate}
                        />

                        <EventClassification
                            event={event}
                            onUpdate={handleUpdate}
                        />

                        <InstructorsField
                            event={event}
                            onBlurCallback={handleUpdate}
                        />

                        <EventToggles event={event} onUpdate={handleUpdate} />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button
                        color="error"
                        disabled={!("id" in event) || !event?.id}
                        onClick={() =>
                            "id" in event ? onDelete(event.id as string) : {}
                        }
                    >
                        מחק
                    </Button>
                    <Button onClick={onClose}>ביטול</Button>
                    <Button
                        disabled={!event?.name?.trim()}
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
