import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useMemo } from "react";

import { useHiveLessons } from "@/components/base/HiveLessonsProvider";

export type HiveLessonSelectProps = {
    /** Selected lesson id (controlled). Use null for no selection. */
    value: null | number;
    /** Fired with the picked lesson id, or null when cleared. */
    onChange: (lessonId: null | number) => void;
    /**
     * Scope the options to a single module. When omitted, every lesson is
     * offered. Passing a module enables cascading module → lesson picking.
     */
    module?: null | number | string;
    /** Field label. Defaults to the Hebrew "שיעור". */
    label?: string;
    /** Render a leading empty option so the user can clear the choice. */
    allowEmpty?: boolean;
    /** Label for the empty option. */
    emptyLabel?: string;
} & Omit<FormControlProps, "onChange">;

/**
 * Reusable, self-contained MUI selector for a single Hive Lesson.
 * Data comes from HiveLessonsProvider; pass `module` to scope the list.
 */
export function HiveLessonSelect({
    value,
    onChange,
    module,
    label = "שיעור",
    allowEmpty = false,
    emptyLabel = "ללא שיעור",
    disabled,
    ...formControlProps
}: HiveLessonSelectProps) {
    const { lessons, getLessonsOfModule } = useHiveLessons();

    const options = useMemo(() => {
        const scoped =
            module !== undefined && module !== null
                ? getLessonsOfModule(Number(module))
                : lessons;
        return [...scoped].sort((a, b) => a.name.localeCompare(b.name, "he"));
    }, [module, lessons, getLessonsOfModule]);

    return (
        <FormControl
            disabled={disabled || options.length === 0}
            {...formControlProps}
        >
            <InputLabel>{label}</InputLabel>
            <Select
                label={label}
                onChange={(e) =>
                    onChange(e.target.value ? Number(e.target.value) : null)
                }
                value={value ?? ""}
            >
                {allowEmpty ? (
                    <MenuItem value="">
                        <em>{emptyLabel}</em>
                    </MenuItem>
                ) : null}
                {options.map((lesson) => (
                    <MenuItem key={lesson.id} value={lesson.id}>
                        {lesson.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
