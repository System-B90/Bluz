import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useMemo } from "react";

import { SubjectLike } from "@/api-shared/types/subject";
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
    value,
    onChange,
    subject,
    label = "מערך",
    allowEmpty = false,
    emptyLabel = "ללא מערך",
    disabled,
    ...formControlProps
}: HiveModuleSelectProps) {
    const { modules, getModulesOfSubject } = useHiveModules();

    const options = useMemo(() => {
        const scoped =
            subject !== undefined ? getModulesOfSubject(subject) : modules;
        return [...scoped].sort((a, b) => a.name.localeCompare(b.name, "he"));
    }, [subject, modules, getModulesOfSubject]);

    return (
        <FormControl
            disabled={disabled || options.length === 0}
            {...formControlProps}
        >
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
                {options.map((module) => (
                    <MenuItem key={module.id} value={module.id}>
                        {module.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
