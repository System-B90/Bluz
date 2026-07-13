import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useMemo } from "react";

import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";

export type HiveSubjectSelectProps = {
    /** Selected subject id (controlled). Use null/"" for no selection. */
    value: null | string;
    /** Fired with the picked subject id, or null when cleared. */
    onChange: (subjectId: null | string) => void;
    /** Field label. Defaults to the Hebrew "מקצוע". */
    label?: string;
    /** Render a leading empty option so the user can clear the choice. */
    allowEmpty?: boolean;
    /** Label for the empty option. */
    emptyLabel?: string;
} & Omit<FormControlProps, "onChange">;

/**
 * Reusable, self-contained MUI selector for a single Hive Subject.
 * Data comes from HiveSubjectsProvider; pair with HiveModuleSelect /
 * HiveLessonSelect for a cascading subject → module → lesson picker.
 */
export function HiveSubjectSelect({
    value,
    onChange,
    label = "מקצוע",
    allowEmpty = false,
    emptyLabel = "ללא מקצוע",
    ...formControlProps
}: HiveSubjectSelectProps) {
    const { subjects } = useHiveSubjects();

    const sortedSubjects = useMemo(
        () => [...subjects].sort((a, b) => a.name.localeCompare(b.name, "he")),
        [subjects],
    );

    return (
        <FormControl {...formControlProps}>
            <InputLabel>{label}</InputLabel>
            <Select
                label={label}
                onChange={(e) => onChange(e.target.value || null)}
                value={value ?? ""}
            >
                {allowEmpty ? (
                    <MenuItem value="">
                        <em>{emptyLabel}</em>
                    </MenuItem>
                ) : null}
                {sortedSubjects.map((subject) => (
                    <MenuItem key={subject.id} value={subject.id}>
                        {subject.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
