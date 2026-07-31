import { FormControlProps } from "@mui/material/FormControl";

import { EntitySelect } from "@/components/base/EntitySelect";
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
    label = "מקצוע",
    emptyLabel = "ללא מקצוע",
    ...rest
}: HiveSubjectSelectProps) {
    const { subjects } = useHiveSubjects();

    return (
        <EntitySelect<string>
            disableWhenEmpty={false}
            emptyLabel={emptyLabel}
            label={label}
            options={subjects}
            parseValue={String}
            {...rest}
        />
    );
}
