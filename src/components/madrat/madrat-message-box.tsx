'use client';

import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { apiGetMadratMessage, apiPostMadratMessage } from '@/api-client/madrat';
import { useAuth } from '@/components/auth-provider';
import { MessageHandlerType } from '@/components/session-ws';
import { MessageTypes } from '@/session-server/src/common';
import '@/style/madrat-message-box.css';
import { TextField } from "@mui/material";
import { enqueueSnackbar } from 'notistack';
import { ChangeEventHandler, useCallback, useEffect, useRef, useState } from "react";

export default function MadratMessageBox()
{
    const [ message, setMessage ] = useState<string>('');
    const [ isDirty, setIsDirty ] = useState(false);
    const dirtyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstLoad = useRef(true);

    const { canEdit, addMessageHandler } = useAuth();

    const slowLoadMessageData = useCallback(async () =>
    {
        return apiGetMadratMessage()
            .then((data) =>
            {
                if (isFirstLoad.current || !isDirty)
                {
                    setMessage(data);
                    isFirstLoad.current = false;
                }
            })
            .catch((error) =>
            {
                enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת הודעות המדר"ת נכשלה!', error);
            });
    }, [ setMessage, isDirty ]);

    // Handle live updates from the server
    const madratTextChangeHandler: MessageHandlerType = useCallback((messageType, data) =>
    {
        if (messageType !== MessageTypes.MADRAT_TEXT_UPDATE) return;
        if (!isDirty)
        {
            setMessage(data as string);
        }
    }, [ isDirty ]);

    // Handle local text changes with debounce and set isDirty
    const onTextChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = useCallback((event) =>
    {
        const value = event.target.value;
        setMessage(value);
        setIsDirty(true);

        // Reset debounce timeout
        if (dirtyTimeoutRef.current)
        {
            clearTimeout(dirtyTimeoutRef.current);
        }
        dirtyTimeoutRef.current = setTimeout(() =>
        {
            setIsDirty(false);

        }, 1000); // 1 second(s) of inactivity

        apiPostMadratMessage(value).catch((error) =>
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, 'שליחת הודעות מדר"ת נכשלה!', error);
        });
    }, []);

    // Register message handler for server pushes
    useEffect(() =>
    {
        return addMessageHandler(madratTextChangeHandler);
    }, [ addMessageHandler, madratTextChangeHandler ]);

    // Load initial content from server
    useEffect(() =>
    {
        slowLoadMessageData();
    }, [ slowLoadMessageData ]);

    // Cleanup the timeout on unmount
    useEffect(() =>
    {
        return () =>
        {
            if (dirtyTimeoutRef.current)
            {
                clearTimeout(dirtyTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="relative max-w-full max-y-full w-full h-full p-4 box-border overflow-hidden" dir='rtl'>
            <div className="relative rounded-sm bg-[rgba(20,20,20,0.9)] w-full h-full box-border overflow-hidden flex flex-wrap p-4" dir='rtl'>
                <TextField
                    id="madrat-message-box"
                    type="text"
                    className="madrat-message-box w-full h-full"
                    sx={ { overflowWrap: "break-word", overflowX: "hidden" } }
                    disabled={ !canEdit }
                    onChange={ onTextChange }
                    multiline
                    autoFocus
                    minRows={ 20 }
                    value={ message }
                />
            </div>
        </div>
    );
}
