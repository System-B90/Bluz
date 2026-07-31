import { FormControlProps } from "@mui/material/FormControl";
import { useMemo } from "react";

import { EntitySelect } from "@/components/base/EntitySelect";
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
    module,
    label = "שיעור",
    emptyLabel = "ללא שיעור",
    ...rest
}: HiveLessonSelectProps) {
    const { lessons, getLessonsOfModule } = useHiveLessons();

    const options = useMemo(
        () =>
            module !== undefined && module !== null
                ? getLessonsOfModule(Number(module))
                : lessons,
        [module, lessons, getLessonsOfModule],
    );

    return (
        <EntitySelect<number>
            emptyLabel={emptyLabel}
            label={label}
            options={options}
            parseValue={Number}
            {...rest}
        />
    );
}
