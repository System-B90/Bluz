'use client';

import assert from 'assert';

import
    {
        Box,
        Button,
        Dialog,
        DialogActions,
        DialogContent,
        DialogTitle,
    } from '@mui/material';
import { useSnackbar } from 'notistack';
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { apiGetMultipleEvents } from '@/api-client/calendar';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { useOffline } from '@/components/base/OfflineProvider';
import { useCalendar } from '@/components/schedule/calendar/calendar-provider/CalendarContext';
import { EventCollisionsList } from '@/components/schedule/offline-dialogs/push-updates-dialog/EventCollisionsList';
import { CollisionStates, PushOfflineUpdatesDialogProps } from '@/components/schedule/offline-dialogs/push-updates-dialog/types';
import { areEventsEqual } from '@/components/schedule/types/EventUtils';

export function PushOfflineUpdatesDialog({

}: PushOfflineUpdatesDialogProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { pushDialogOpen, getCapturedEvent } = useOffline();
    const { events: localEvents } = useCalendar();
    const [ collisionStates, setCollisionStates ] = useState<CollisionStates>({});

    const onClose = useCallback(() => { }, []);
    const submitHandler = useCallback((e: FormEvent<HTMLFormElement>) =>
    {
        e.preventDefault();
    }, []);

    const checkEventCollisionStates = useCallback(async (): Promise<CollisionStates> =>
    {
        const states: CollisionStates = {};

        // Get the saved copy of the events we changed locally from before they were changed
        const capturedEventsBeforeEdit = localEvents.map((event) => getCapturedEvent(event.id)).filter((ev) => !!ev);

        const serverEvents = await apiGetMultipleEvents(localEvents.map((ev) => ev.id))
            .catch((error) => { enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת המצב העדכני בשרת נכשלה!`, error); return null; });
        if (serverEvents === null) { return {}; }

        // console.log('capturedEventsBeforeEdit', capturedEventsBeforeEdit);
        // console.log('serverEvents', serverEvents);

        capturedEventsBeforeEdit.forEach((capturedEventBeforeEdit) =>
        {
            // For each of the events we changed locally and have a capture, check if the server version changed between the capture and the new data
            const serverVersion = serverEvents[ capturedEventBeforeEdit.id ];
            assert(serverVersion === undefined || capturedEventBeforeEdit === undefined || serverVersion.id === capturedEventBeforeEdit.id); // Sanity

            states[ capturedEventBeforeEdit.id ] = {
                localModifiedEvent: localEvents.find((ev) => ev.id === capturedEventBeforeEdit.id),
                capturedVersion: capturedEventBeforeEdit,
                serverVersion,
                conflicting: !areEventsEqual(capturedEventBeforeEdit, serverVersion)
            };
        });

        return states;

    }, [ localEvents, getCapturedEvent, enqueueSnackbar ]);

    useEffect(() =>
    {
        if (!pushDialogOpen) { return; }
        checkEventCollisionStates()
            .then(setCollisionStates)
            .catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת המצב העדכני בשרת נכשלה!`, error));
    }, [ pushDialogOpen, checkEventCollisionStates, setCollisionStates, enqueueSnackbar ]);

    const collisionListKey = useMemo(() => Object.values(collisionStates)
        .map((cs) => `${cs.localModifiedEvent?.id}-${cs.conflicting ? '1' : '0'}`)
        .join('--'), [ collisionStates ]);

    return (
        <Dialog fullWidth maxWidth="lg" onClose={ onClose } open={ pushDialogOpen }>
            <DialogTitle>שמירת שינויים לוקלים</DialogTitle>

            <form onSubmit={ submitHandler }>
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <Box display={ 'flex' } gap={ 2 } width={ '100%' }>
                            <EventCollisionsList collisionStates={ collisionStates } key={ collisionListKey } />
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button color='warning' onClick={ () => { } }>שחזר</Button>
                    <Button color='secondary' onClick={ onClose }>ביטול</Button>
                    <Button
                        color='success'
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
