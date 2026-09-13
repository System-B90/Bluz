import { FormControlProps } from "@mui/material/FormControl";
import { useMemo } from "react";

import { HiveLessonId } from "@/api-shared/types/hive";
import { EntitySelect } from "@/components/base/EntitySelect";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";

export type HiveLessonSelectProps = {
    /** Selected lesson id (controlled). Use null for no selection. */
    value: HiveLessonId | null;
    /** Fired with the picked lesson id, or null when cleared. */
    onChange: (lessonId: HiveLessonId | null) => void;
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

    const scoped = useMemo(
        () =>
            module !== undefined && module !== null
                ? getLessonsOfModule(Number(module))
                : lessons,
        [module, lessons, getLessonsOfModule],
    );

    // EntitySelect needs one uniform id type for its options and its
    // controlled value; lesson ids can be a Hive numeric pk or a UUID
    // depending on the instance, so everything is normalized to a string
    // here rather than coerced with Number() (#682-adjacent — that coercion
    // is exactly what made a UUID lesson id turn into NaN and never match).
    const options = useMemo(
        () =>
            scoped.map((lesson) => ({ id: String(lesson.id), name: lesson.name })),
        [scoped],
    );

    return (
        <EntitySelect<string>
            {...rest}
            emptyLabel={emptyLabel}
            label={label}
            onChange={(id) => rest.onChange(id)}
            options={options}
            parseValue={String}
            value={rest.value != null ? String(rest.value) : null}
        />
    );
}
