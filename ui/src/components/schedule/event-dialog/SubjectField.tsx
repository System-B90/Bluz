import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type SubjectFieldProps = {
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
};

export function SubjectField({
    event,
    onEventChange,
    ...props
}: SubjectFieldProps & FormControlProps) {
    const { subjects } = useHiveSubjects();

    const subjectMenuItems = subjects.map((subject) => (
        <MenuItem key={subject.id} value={subject.id}>
            {subject.name}
        </MenuItem>
    ));

    return (
        <FormControl
            disabled={event?.type ? !eventHasSubject(event?.type) : false}
            fullWidth={false}
            {...props}
        >
            <InputLabel>מקצוע</InputLabel>
            <Select
                label="מקצוע"
                onChange={(e) => onEventChange({ subject: e.target.value })}
                value={event?.subject || ""}
            >
                {subjectMenuItems}
            </Select>
        </FormControl>
    );
}
