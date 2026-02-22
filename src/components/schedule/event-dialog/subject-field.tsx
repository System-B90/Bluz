import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { eventHasSubject, Event } from "@/components/schedule/types/event";
import { FormControl, FormControlProps, InputLabel, MenuItem, Select } from "@mui/material";

interface SubjectFieldProps
{
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
}

export default function SubjectField({ event, onEventChange, ...props }: SubjectFieldProps & FormControlProps)
{
    const { subjects } = useHiveSubjects();

    const subjectMenuItems = subjects.map((subject) => (
        <MenuItem key={ subject.id } value={ subject.id }>
            { subject.name }
        </MenuItem>
    ));

    return (
        <FormControl fullWidth={ false } disabled={ event?.type ? !eventHasSubject(event?.type) : false } { ...props }>
            <InputLabel>מקצוע</InputLabel>
            <Select
                value={ event?.subject || "" }
                label="מקצוע"
                onChange={ (e) => onEventChange({ subject: e.target.value }) }
            >
                { subjectMenuItems }
            </Select>
        </FormControl>
    );
}
