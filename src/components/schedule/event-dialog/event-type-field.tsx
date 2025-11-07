import {FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {EVENT_TYPES} from "@/components/schedule/types/types";
import {Period} from "@/components/schedule/types/event";

interface EventTypeFieldProps {
    period?: Partial<Period>;
    onPeriodChange: (period: Partial<Period>) => void;
}

export default function EventTypeField({period, onPeriodChange}: EventTypeFieldProps) {
    return (
        <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
                value={period?.type || "exercise"}
                label="Type"
                onChange={(e) => onPeriodChange({type: e.target.value})}
            >
                {EVENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                        {type.label}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}