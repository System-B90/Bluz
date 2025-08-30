'use client';
import { Autocomplete, Box, FormGroup, IconButton, Paper, TextField, Tooltip, Popper } from "@mui/material";
import React, { ChangeEventHandler, Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
import CallMadeIcon from '@mui/icons-material/CallMade';
import { apiCallStudentToHadas } from "@/api-client/call-to-hadas";
import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { enqueueSnackbar } from "notistack";
import { useStudents } from "@/components/students-provider";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import AlarmIcon from "@mui/icons-material/Alarm";
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from "dayjs";
import { PickerValue } from "@mui/x-date-pickers/internals";

function AlarmClockTimePickerForm({ time, setTime }: { time: PickerValue, setTime: Dispatch<SetStateAction<PickerValue>>; })
{
    const [ open, setOpen ] = useState(false);
    const anchorRef = useRef(null);

    const openPoppover = useCallback(() =>
    {
        setOpen(true);
    }, [ setOpen ]);

    return (
        <LocalizationProvider dateAdapter={ AdapterDayjs }>
            <Tooltip title="פקיעה" className="shrink grow-0">
                <IconButton ref={ anchorRef } onClick={ openPoppover }>
                    <AlarmIcon className="p-0 m-0" fontSize='large' />
                </IconButton>
            </Tooltip>

            <Popper open={ open } anchorEl={ anchorRef.current } placement='auto'>
                <TimePicker
                    open
                    onClose={ () => setOpen(false) }
                    value={ time }
                    onChange={ setTime }
                    ampm={ false }
                    minutesStep={ 15 }
                    timeSteps={ { minutes: 15 } }
                    disablePast
                    openTo="minutes"
                    closeOnSelect
                    slotProps={ {
                        textField: { style: { display: 'none', }, }, // Hide input field
                        popper: {
                            anchorEl: anchorRef.current,
                            open: open,
                            placement: 'auto',
                        },
                    } }
                />
            </Popper>
        </LocalizationProvider>
    );
}

export default function CallStudentToHadas()
{
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ selectedStudents, setSelectedStudents ] = useState<Array<string>>([]);
    const [ reason, setReason ] = useState<string>('');
    const [ expirationTime, setExpirationTime ] = useState<Dayjs | null>(
        dayjs().add(1, 'hour').minute(dayjs().minute() + 4 - ((dayjs().minute() + 4) % 5))
    );

    const { students } = useStudents();

    const formSubmitCallback = useCallback(async (formData: FormData): Promise<void> =>
    {
        if (expirationTime === null)
        {
            return;
        }
        setLoading(true);
        apiCallStudentToHadas({ studentNames: selectedStudents, reason, expirationTime })
            .then(() =>
            {
                setSelectedStudents([]);
                setReason('');
            })
            .catch((error) => { enqueueApiErrorSnackbar(enqueueSnackbar, 'הקריאה נכשלה!', error); })
            .finally(() =>
                setLoading(false)
            );
    }, [ reason, selectedStudents, expirationTime, setLoading, setSelectedStudents ]);

    const selectedStudentsChangeCallback = useCallback((_event: React.SyntheticEvent, newValue: Array<string>) =>
    {
        setSelectedStudents(newValue);
    }, [ setSelectedStudents ]);

    const reasonValueChangeCallback: ChangeEventHandler<HTMLInputElement> = useCallback((event) =>
    {
        setReason(event.currentTarget.value);
    }, [ setReason ]);

    return (
        <Paper elevation={ 1 }>
            <Box component={ 'form' } className="flex flex-row items-end p-2" dir="rtl"
                action={ formSubmitCallback }
                noValidate
                autoComplete="off">
                <FormGroup className="gap-2 w-full">
                    <FormGroup row className="flex flex-row items-center w-full flex-nowrap" style={ { flexWrap: 'nowrap' } }>
                        <Autocomplete
                            className="grow"
                            color="primary"
                            dir="rtl"
                            options={ students.map((v) => v.name) }
                            onChange={ selectedStudentsChangeCallback }
                            multiple
                            disableCloseOnSelect
                            value={ selectedStudents }
                            renderInput={ (params) => <TextField { ...params } name="student-name" label='שם החניך' /> }
                        />
                        <AlarmClockTimePickerForm time={ expirationTime } setTime={ setExpirationTime } />
                    </FormGroup>
                    <FormGroup row className="flex flex-row items-center w-full flex-nowrap" style={ { flexWrap: 'nowrap' } }>
                        <TextField name="reason" label='סיבה' className="grow shrink-0" value={ reason } onChange={ reasonValueChangeCallback } />
                        <Tooltip title="קרא לחניכים" className="shrink grow-0">
                            <IconButton type='submit' loading={ loading }>
                                <CallMadeIcon />
                            </IconButton>
                        </Tooltip>
                    </FormGroup>
                </FormGroup>
            </Box>
        </Paper>
    );
}
