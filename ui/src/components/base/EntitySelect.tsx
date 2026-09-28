import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useMemo, useId, useState } from "react";

import {
    searchableMenuProps,
    SelectSearchHeader,
} from "@/components/base/SelectSearchHeader";

/** Minimal shape every Hive entity offered in a dropdown satisfies. */
export type NamedEntity<TId extends number | string> = {
    id: TId;
    name: string;
};

export type EntitySelectProps<TId extends number | string> = {
    /** Selected entity id (controlled). Use null for no selection. */
    value: null | TId;
    /** Fired with the picked entity id, or null when cleared. */
    onChange: (id: null | TId) => void;
    /** Options to offer. Sorted by name (Hebrew collation) internally. */
    options: ReadonlyArray<NamedEntity<TId>>;
    /** Field label. */
    label: string;
    /** Render a leading empty option so the user can clear the choice. */
    allowEmpty?: boolean;
    /** Label for the empty option. */
    emptyLabel?: string;
    /** Disable the control when there is nothing to pick. Defaults to true. */
    disableWhenEmpty?: boolean;
    /** Coerce the raw `<select>` value back to the id type. */
    parseValue: (raw: string) => TId;
    /** Top the menu with a type-to-filter search box. */
    searchable?: boolean;
    /** Placeholder for the search box. */
    searchPlaceholder?: string;
} & Omit<FormControlProps, "onChange">;

/**
 * Shared MUI single-entity dropdown behind every `Hive*Select`: Hebrew-sorted
 * options, an optional empty entry, and null-normalized change events. Wrap it
 * with a provider-specific component rather than using it directly in screens.
 */
export function EntitySelect<TId extends number | string>({
    value,
    onChange,
    options,
    label,
    allowEmpty = false,
    emptyLabel,
    disableWhenEmpty = true,
    parseValue,
    searchable = false,
    searchPlaceholder = "חיפוש...",
    disabled,
    ...formControlProps
}: EntitySelectProps<TId>) {
    const labelId = useId();
    const sorted = useMemo(
        () => [...options].sort((a, b) => a.name.localeCompare(b.name, "he")),
        [options],
    );
    const [searchQuery, setSearchQuery] = useState("");
    const visible = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return sorted;
        // The selected option always stays: MUI renders a blank field for a
        // value with no matching MenuItem.
        return sorted.filter(
            (option) =>
                option.id === value ||
                option.name.toLowerCase().includes(query),
        );
    }, [sorted, searchQuery, value]);

    return (
        <FormControl
            disabled={disabled || (disableWhenEmpty && sorted.length === 0)}
            {...formControlProps}
        >
            <InputLabel id={ labelId }>{label}</InputLabel>
            <Select label={label}
                labelId={ labelId }
                MenuProps={searchable ? searchableMenuProps(undefined) : undefined}
                onChange={(e) =>
                    onChange(
                        e.target.value === "" || e.target.value == null
                            ? null
                            : parseValue(String(e.target.value)),
                    )
                }
                onClose={() => setSearchQuery("")}
                value={value ?? ""}
            >
                {searchable ? (
                    <SelectSearchHeader
                        onChange={setSearchQuery}
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                    />
                ) : null}
                {allowEmpty ? (
                    <MenuItem value="">
                        <em>{emptyLabel}</em>
                    </MenuItem>
                ) : null}
                {visible.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                        {option.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}
