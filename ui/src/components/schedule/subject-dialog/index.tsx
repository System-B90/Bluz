'use client';

import
{
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    OutlinedInput,
    Select,
    TextField,
} from '@mui/material';
import { useState } from 'react';

import { Subject } from "@/components/schedule/types/subject";

const availableGroups = [ 'Group A', 'Group B', 'Group C' ];

interface SubjectDialogProps
{
    open: boolean;
    subject: Partial<Subject>;
    onClose: () => void;
    onSave: (subject: Subject) => void;
}

export default function SubjectDialog({ open, subject, onClose, onSave }: SubjectDialogProps)
{
    const [ name, setName ] = useState('');
    const [ displayName, setDisplayName ] = useState('');
    const [ color, setColor ] = useState('#1976d2');
    const [ groups, setGroups ] = useState<string[]>([]);

    const handleSave = () =>
    {
        onSave({ id: "", name, displayName, color, defaultGroupIDs: groups });
        setName('');
        setDisplayName('');
        setColor('#1976d2');
        setGroups([]);
        onClose();
    };

    return (
        <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="sm">
            <DialogTitle>Define New Subject</DialogTitle>
            <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 2, mt: 1 } }>
                <TextField
                    label="Name"
                    value={ name }
                    onChange={ (e) => setName(e.target.value) }
                    fullWidth
                />
                <TextField
                    label="Display Name"
                    value={ displayName }
                    onChange={ (e) => setDisplayName(e.target.value) }
                    fullWidth
                />
                <Box display="flex" alignItems="center" gap={ 2 }>
                    <TextField
                        label="Color"
                        type="color"
                        value={ color }
                        onChange={ (e) => setColor(e.target.value) }
                        sx={ { width: 120 } }
                    />
                    <Box sx={ { fontWeight: 500 } }>{ color }</Box>
                </Box>
                <FormControl fullWidth>
                    <InputLabel>Assigned Groups</InputLabel>
                    <Select
                        multiple
                        value={ groups }
                        onChange={ (e) => setGroups(e.target.value as string[]) }
                        input={ <OutlinedInput label="Assigned Groups" /> }
                        renderValue={ (selected) => (
                            <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5 } }>
                                { selected.map((value) => (
                                    <Chip key={ value } label={ value } />
                                )) }
                            </Box>
                        ) }
                    >
                        { availableGroups.map((group) => (
                            <MenuItem key={ group } value={ group }>
                                { group }
                            </MenuItem>
                        )) }
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={ onClose }>Cancel</Button>
                <Button onClick={ handleSave } variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
}
