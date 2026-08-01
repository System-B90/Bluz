import { FormControlProps } from "@mui/material/FormControl";
import { useMemo } from "react";

import { SubjectLike } from "@/api-shared/types/subject";
import { EntitySelect } from "@/components/base/EntitySelect";
import { useHiveModules } from "@/components/base/HiveModulesProvider";

export type HiveModuleSelectProps = {
    /** Selected module id (controlled). Use null/"" for no selection. */
    value: null | string;
    /** Fired with the picked module id, or null when cleared. */
    onChange: (moduleId: null | string) => void;
    /**
     * Scope the options to a single subject. When omitted, every module is
     * offered. Passing a subject enables cascading subject → module picking.
     */
    subject?: SubjectLike;
    /** Field label. Defaults to the Hebrew "מערך". */
    label?: string;
    /** Render a leading empty option so the user can clear the choice. */
    allowEmpty?: boolean;
    /** Label for the empty option. */
    emptyLabel?: string;
} & Omit<FormControlProps, "onChange">;

/**
 * Reusable, self-contained MUI selector for a single Hive Module.
 * Data comes from HiveModulesProvider; pass `subject` to scope the list.
 */
export function HiveModuleSelect({
    subject,
    label = "מערך",
    emptyLabel = "ללא מערך",
    ...rest
}: HiveModuleSelectProps) {
    const { modules, getModulesOfSubject } = useHiveModules();

    const options = useMemo(
        () => (subject !== undefined ? getModulesOfSubject(subject) : modules),
        [subject, modules, getModulesOfSubject],
    );

    return (
        <EntitySelect<string>
            emptyLabel={emptyLabel}
            label={label}
            options={options}
            parseValue={String}
            {...rest}
        />
    );
}
