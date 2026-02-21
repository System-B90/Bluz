import { useState } from "react";
import
{
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Chip,
    OutlinedInput,
} from "@mui/material";

export default function PersonalSettings()
{
    const [ groups, setGroups ] = useState<string[]>([]);
    const [ instructors, setInstructors ] = useState<string[]>([]);

    const allGroups = [ "Group A", "Group B", "Group C" ];
    const allInstructors = [ "Alice", "Bob", "Charlie" ];

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                הגדרות אישיות
            </Typography>

            {/* Groups Selection */ }
            <FormControl fullWidth sx={ { mb: 3 } }>
                <InputLabel>Selected Groups</InputLabel>
                <Select
                    multiple
                    value={ groups }
                    onChange={ (e) => setGroups(e.target.value as string[]) }
                    input={ <OutlinedInput label="Selected Groups" /> }
                    renderValue={ (selected) => (
                        <Box sx={ { display: "flex", flexWrap: "wrap", gap: 0.5 } }>
                            { selected.map((value) => (
                                <Chip key={ value } label={ value } />
                            )) }
                        </Box>
                    ) }
                >
                    { allGroups.map((group) => (
                        <MenuItem key={ group } value={ group }>
                            { group }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

            {/* Instructors Selection */ }
            <FormControl fullWidth>
                <InputLabel>Selected Instructors</InputLabel>
                <Select
                    multiple
                    value={ instructors }
                    onChange={ (e) => setInstructors(e.target.value as string[]) }
                    input={ <OutlinedInput label="Selected Instructors" /> }
                    renderValue={ (selected) => (
                        <Box sx={ { display: "flex", flexWrap: "wrap", gap: 0.5 } }>
                            { selected.map((value) => (
                                <Chip key={ value } label={ value } />
                            )) }
                        </Box>
                    ) }
                >
                    { allInstructors.map((inst) => (
                        <MenuItem key={ inst } value={ inst }>
                            { inst }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>
        </Box>
    );
};
