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
                        <TextField
                            label="Subject"
                            fullWidth
                            value={period?.subject || ''}
                            onChange={(e) => onPeriodChange({ subject: e.target.value })}
                        />
                        <EventTypeField period={period} onPeriodChange={onPeriodChange}/>
                        <TimePicker
                            label="Start Time"
                            value={period?.startTime || dayjs()}
                            onChange={(time) => onPeriodChange({ startTime: time || dayjs() })}
                            slotProps={{ textField: { fullWidth: true } }}
                        />
                        <TimePicker
                            label="End Time"
                            value={period?.endTime || dayjs()}
                            onChange={(time) => onPeriodChange({ endTime: time || dayjs() })}
                            slotProps={{ textField: { fullWidth: true } }}
                        />
                        <TextField
                            label="Location"
                            fullWidth
                            value={period?.location || ''}
                            onChange={(e) => onPeriodChange({ location: e.target.value })}
                        />
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
