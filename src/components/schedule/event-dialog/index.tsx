'use client';

import EventTypeField from "@/components/schedule/event-dialog/event-type-field";
import InstructorsField from "@/components/schedule/event-dialog/instructors-field";
import RoomField from "@/components/schedule/event-dialog/room-field";
import SubjectField from "@/components/schedule/event-dialog/subject-field";
import EventTimeField from "@/components/schedule/event-dialog/time-fields";
import { Period } from "@/components/schedule/types/event";
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

interface PeriodDialogProps
{
    open: boolean;
    period: Partial<Period>;
    onClose: () => void;
    onSave: (period: Partial<Period>) => void;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function PeriodDialog({
    open,
    period,
    onClose,
    onSave,
    onPeriodChange,
}: PeriodDialogProps)
{
    return (
        <Dialog open={ open } onClose={ onClose } maxWidth="md" fullWidth>
            <DialogTitle>ערוך מופע</DialogTitle>
            <form
                onSubmit={ (e) =>
                {
                    e.preventDefault();
                    onSave(period);
                } }
            >
                <DialogContent>
                    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                        <TextField
                            label="שם"
                            fullWidth
                            required
                            value={ period?.name || "" }
                            onChange={ (e) => onPeriodChange({ name: e.target.value }) }
                        />
                        <SubjectField period={ period } onPeriodChange={ onPeriodChange } />
                        <EventTypeField period={ period } onPeriodChange={ onPeriodChange } />
                        <EventTimeField period={ period } onPeriodChange={ onPeriodChange } />
                        <RoomField period={ period } onPeriodChange={ onPeriodChange } />
                        <InstructorsField period={ period } onPeriodChange={ onPeriodChange } />
                        <TextField
                            label="הערות"
                            fullWidth
                            multiline
                            rows={ 3 }
                            value={ period?.notes || '' }
                            onChange={ (e) => onPeriodChange({ notes: e.target.value }) }
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={ period?.locked || false }
                                    onChange={ (e) => onPeriodChange({ locked: e.target.checked }) }
                                />
                            }
                            label="נעול"
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={ period?.required || false }
                                    onChange={ (e) => onPeriodChange({ required: e.target.checked }) }
                                />
                            }
                            label="קריטי"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={ onClose }>ביטול</Button>
                    <Button type="submit" variant="contained" disabled={ !period?.name }>
                        שמור
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
