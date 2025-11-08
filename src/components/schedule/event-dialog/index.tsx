'use client';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Chip,
    Switch,
    FormControlLabel,
    Button,
    Box,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import {Period} from "@/components/schedule/types/event";
import {DEFAULT_INSTRUCTORS, EVENT_TYPES} from "@/components/schedule/types/types";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";

interface PeriodDialogProps {
    open: boolean;
    period?: Partial<Period>;
    onClose: () => void;
    onSave: (period?: Partial<Period>) => void;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function PeriodDialog({
                                         open,
                                         period,
                                         onClose,
                                         onSave,
                                         onPeriodChange,
                                     }: PeriodDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Edit Period</DialogTitle>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(period);
                }}
            >
                <DialogContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name"
                            fullWidth
                            required
                            value={period?.name || ""}
                            onChange={(e) => onPeriodChange({ name: e.target.value })}
                        />
                        <SubjectField period={period} onPeriodChange={onPeriodChange}/>
                        <EventTypeField period={period} onPeriodChange={onPeriodChange}/>
                        <EventTimeField period={period} onPeriodChange={onPeriodChange}/>
                        <RoomField period={period} onPeriodChange={onPeriodChange}/>
                        <InstructorsField period={period} onPeriodChange={onPeriodChange}/>
                        <TextField
                            label="Notes"
                            fullWidth
                            multiline
                            rows={3}
                            value={period?.notes || ''}
                            onChange={(e) => onPeriodChange({ notes: e.target.value })}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={period?.locked || false}
                                    onChange={(e) => onPeriodChange({ locked: e.target.checked })}
                                />
                            }
                            label="Locked"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={period?.required || false}
                                    onChange={(e) => onPeriodChange({ required: e.target.checked })}
                                />
                            }
                            label="Required"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={!period?.name}>
                        Save
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
