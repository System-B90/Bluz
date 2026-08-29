"use client";

import LockPersonIcon from "@mui/icons-material/LockPerson";
import ViewTimelineIcon from "@mui/icons-material/ViewTimeline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { FormEvent, useCallback, useState } from "react";

import { GANTT_EVENT_DEEP_LINK_PARAM } from "@/components/gantt/curriculum-view/search/GanttEventDeepLink";
import { EventHistoryPanel } from "@/components/schedule/event-dialog/event-history";
import { EventClassification } from "@/components/schedule/event-dialog/EventClassification";
import { EventPrimaryDetails } from "@/components/schedule/event-dialog/EventPrimaryDetails";
import { EventToggles } from "@/components/schedule/event-dialog/EventToggles";
import { HiveQueueMapping } from "@/components/schedule/event-dialog/HiveQueueMapping";
import { InstructorsField } from "@/components/schedule/event-dialog/InstructorsField";
import { Event, EventId } from "@/components/schedule/types/event";

/** Sunday-first, matching `Dayjs#day()`. */
const HEBREW_WEEKDAYS = [
    "ראשון",
    "שני",
    "שלישי",
    "רביעי",
    "חמישי",
    "שישי",
    "שבת",
];

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
}: EventDialogProps)
{
    const [ event, setEventRaw ] = useState<EventOrPartial>({ ...inputEvent });
    const [ prevOpen, setPrevOpen ] = useState(open);
    // Identity, not reference: the parent hands over a fresh object on every
    // render, and resetting on that would wipe whatever the user is currently
    // typing. Only a genuinely different event (or a reopen) reloads the form.
    const inputEventId = "id" in inputEvent ? inputEvent.id : undefined;
    const [ prevInputEventId, setPrevInputEventId ] = useState(inputEventId);

    if (open !== prevOpen || inputEventId !== prevInputEventId)
    {
        setPrevOpen(open);
        setPrevInputEventId(inputEventId);
        if (open)
        {
            setEventRaw({ ...inputEvent });
        }
    }

    // Retain the last known editor name so the warning text stays intact while
    // the banner animates closed (e.g. when the other user releases the lock).
    const [ retainedLockName, setRetainedLockName ] = useState(lockedByName);
    if (lockedByName && lockedByName !== retainedLockName)
    {
        setRetainedLockName(lockedByName);
    }
    const shownLockName = lockedByName ?? retainedLockName;

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
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={ onClose }
            open={ open }
            slotProps={ {
                paper: {
                    sx: {
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    },
                },
            } }
        >
            <DialogTitle sx={ { pb: 1 } }>
                <Stack spacing={ 0.5 }>
                    <Typography component="span" sx={ { fontWeight: "bold" } } variant="h5">
                        עריכת מופע
                    </Typography>

                    { event.startTime ? (
                        <Typography
                            component="span"
                            sx={ { color: "text.secondary" } }
                            variant="caption"
                        >
                            { `יום: ${HEBREW_WEEKDAYS[ event.startTime.day() ]}, ${event.startTime.format("DD/MM/YYYY")}` }
                        </Typography>
                    ) : null }

                    { event.ganttEventId ? (
                        <Link
                            component={ NextLink }
                            href={ `/gantt?${ GANTT_EVENT_DEEP_LINK_PARAM }=${ event.ganttEventId }` }
                            sx={ {
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                width: "fit-content",
                            } }
                            underline="hover"
                            variant="caption"
                        >
                            <ViewTimelineIcon fontSize="inherit" />
                            מעבר למופע בגאנט
                        </Link>
                    ) : null }
                </Stack>
            </DialogTitle>

            { /*
              * The form sits between the Dialog paper's flex column and the
              * content, so it has to carry the column itself — otherwise
              * DialogContent never gets a scroll bound, the form grows past
              * the paper, and DialogActions (with שמירה) is pushed out of
              * reach with no way to scroll to it (#463).
              */ }
            <Box
                component="form"
                onSubmit={ handleSubmit }
                sx={ {
                    display: "flex",
                    flex: "1 1 auto",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                } }
            >
                <DialogContent sx={ { minHeight: 0, overflowY: "auto" } }>
                    <Box
                        sx={ {
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            mt: 1,
                        } }
                    >
                        <Collapse
                            in={ Boolean(
                                event.fake &&
                                (!event.color || !event.notes?.trim()),
                            ) }
                            unmountOnExit
                        >
                            <Alert severity="info" variant="outlined">
                                מופע פיקטיבי דורש בחירת צבע ידני והערה לפני
                                השמירה.
                            </Alert>
                        </Collapse>

                        <Collapse in={ Boolean(lockedByName) } unmountOnExit>
                            <Alert
                                icon={ <LockPersonIcon fontSize="inherit" /> }
                                severity="warning"
                                variant="outlined"
                            >
                                { `משתמש אחר (${shownLockName}) עורך כעת מופע זה. שמירה תדרוס את שינוייו.` }
                            </Alert>
                        </Collapse>

                        <EventPrimaryDetails
                            event={ event }
                            onUpdate={ handleUpdate }
                        />

                        <EventClassification
                            event={ event }
                            onUpdate={ handleUpdate }
                        />

                        <InstructorsField
                            event={ event }
                            onBlurCallback={ handleUpdate }
                        />

                        <EventToggles event={ event } onUpdate={ handleUpdate } />

                        <HiveQueueMapping
                            event={ event }
                            onUpdate={ handleUpdate }
                        />

                        {/* Saved events only: an unsaved one has no log yet. */ }
                        { "id" in event && event.id ? (
                            <EventHistoryPanel eventId={ event.id } />
                        ) : null }
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button
                        color="error"
                        disabled={ !("id" in event) || !event?.id }
                        onClick={ () =>
                            "id" in event ? onDelete(event.id as string) : {}
                        }
                    >
                        מחיקה
                    </Button>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button
                        disabled={
                            !event?.name?.trim() ||
                            Boolean(
                                event.fake &&
                                (!event.color || !event.notes?.trim()),
                            )
                        }
                        type="submit"
                        variant="contained"
                    >
                        שמירה
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}
