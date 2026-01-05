import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { Period } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";

interface SubjectFieldProps
{
    period?: Partial<Period>;
    onPeriodChange: (updates: Partial<Period>) => void;
}

export default function SubjectField({ period, onPeriodChange, ...props }: SubjectFieldProps & FormControlProps)
{
    const { subjects } = useHiveSubjects();

    const subjectMenuItems = subjects.map((subject) => (
        <MenuItem key={ subject.id } value={ subject.id }>
            { subject.name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ period?.type === 'break' } { ...props }>
            <InputLabel>מקצוע</InputLabel>
            <Select
                value={ period?.subject || "" }
                label="מקצוע"
                onChange={ (e) => onPeriodChange({ subject: e.target.value }) }
            >
                { subjectMenuItems }
            </Select>
        </FormControl>
    );
}
