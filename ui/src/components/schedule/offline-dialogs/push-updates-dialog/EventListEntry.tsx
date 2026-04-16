'use client';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import
{
    Box,
    Checkbox,
    Collapse,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { Fragment, useState } from "react";

import { DeletedItemPlaceholder } from './DeletedItemPlaceholder';

import { Event, EventId } from "@/components/schedule/types/event";
import { areValuesEqual } from '@/components/schedule/types/EventUtils';

export function EventListEntry({ isItemSelected, handleEntryClick, eventId, localModifiedEvent, serverVersion, capturedVersion, conflicting }: { isItemSelected: boolean, handleEntryClick: (event: React.MouseEvent<HTMLTableRowElement>, entryId: EventId) => void, eventId: EventId, localModifiedEvent: Event | undefined; serverVersion: Event | undefined; capturedVersion: Event | undefined; conflicting: boolean; })
{
    // console.log(eventId, localModifiedEvent, serverVersion, capturedVersion, conflicting);
    const [ expanded, setExpanded ] = useState<boolean>(false);
    const allKeys: Array<keyof Event> = [ ...new Set([ ...Object.keys(localModifiedEvent ?? {}), ...Object.keys(serverVersion ?? {}), ...Object.keys(capturedVersion ?? {}) ]) ] as Array<keyof Event>;

    const changeItems = allKeys.filter(
        (key) => (
            (localModifiedEvent !== undefined && serverVersion !== undefined && !areValuesEqual(localModifiedEvent?.[ key ], serverVersion?.[ key ])) ||
            (serverVersion !== undefined && capturedVersion !== undefined && !areValuesEqual(serverVersion?.[ key ], capturedVersion?.[ key ])) ||
            (localModifiedEvent !== undefined && capturedVersion !== undefined && !areValuesEqual(localModifiedEvent?.[ key ], capturedVersion?.[ key ]))
        )).map((key) => (
            <TableRow key={ `${eventId}-${key}` }>
                <TableCell><Typography>{ key }</Typography></TableCell>
                <TableCell>{ localModifiedEvent?.[ key ] ? <Typography>{ localModifiedEvent?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
                <TableCell>{ capturedVersion?.[ key ] ? <Typography>{ capturedVersion?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
                <TableCell>{ serverVersion?.[ key ] ? <Typography>{ serverVersion?.[ key ]?.toString() }</Typography> : <DeletedItemPlaceholder /> }</TableCell>
            </TableRow>
        ));

    return (
        <Fragment>
            <TableRow
                sx={ { '& > *': { borderBottom: 'unset' } } } hover
                selected={ isItemSelected }
                role='checkbox'
                aria-checked={ isItemSelected }
                onClick={ (e) => handleEntryClick(e, eventId) }>
                <TableCell>
                    <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={ (e) => { e.stopPropagation(); e.preventDefault(); setExpanded((v) => !v); } }
                    >
                        { expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon /> }
                    </IconButton>
                </TableCell>
                <TableCell component="th" scope="row"><Typography>{ eventId }</Typography></TableCell>
                <TableCell><Typography>{ localModifiedEvent?.name ?? serverVersion?.name ?? capturedVersion?.name }</Typography></TableCell>
                <TableCell><Typography color={ conflicting ? 'error' : 'inherit' }>{ conflicting ? 'קונפליקט!' : 'אין' }</Typography></TableCell>
                <TableCell padding="checkbox">
                    <Checkbox
                        color="primary"
                        checked={ isItemSelected }
                    />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={ { paddingBottom: 0, paddingTop: 0 } } colSpan={ 4 }>
                    <Collapse in={ expanded } timeout="auto" unmountOnExit>
                        <Box sx={ { margin: 1 } }>
                            <Typography variant="h6" gutterBottom component="div">
                                שינויים
                            </Typography>
                            <Table size="small" aria-label="purchases">
                                <TableHead>
                                    <TableRow>
                                        <TableCell><Typography fontWeight={ 600 }>שם השדה</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>השינוי שלך</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>מה שראית לפני ששינית</Typography></TableCell>
                                        <TableCell><Typography fontWeight={ 600 }>מה שיש כרגע בשרת</Typography></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    { changeItems }
                                </TableBody>
                            </Table>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </Fragment>
    );
}
