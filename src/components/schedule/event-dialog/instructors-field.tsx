import {DEFAULT_INSTRUCTORS} from "@/components/schedule/types/types";
import {Autocomplete, Chip, TextField} from "@mui/material";
import {Period} from "@/components/schedule/types/event";

interface InstructorsFieldProps {
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function InstructorsField({period, onPeriodChange}: InstructorsFieldProps) {
    return (
        <Autocomplete
            multiple
            options={DEFAULT_INSTRUCTORS}
            getOptionLabel={(opt) => opt.name}
            value={DEFAULT_INSTRUCTORS.filter((i) =>
                period?.instructors?.includes(i.id)
            )}
            onChange={(_, newValue) =>
                onPeriodChange({instructors: newValue.map((i) => i.id)})
            }
            renderInput={(params) => (
                <TextField {...params} label="Instructors" placeholder="Select instructors"/>
            )}
            renderValue={(value, getTagProps) =>
                value.map((option, index) => (
                    <Chip label={option.name} {...getTagProps({index})} />
                ))
            }
        />
    )
}