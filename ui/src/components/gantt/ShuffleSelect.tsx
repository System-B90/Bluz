import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

/**
 * Multi-select for tagging a Gantt module/event with shuffle (student group)
 * names defined on the parent syllabus. An empty selection means the item
 * applies to all shuffles.
 */
export function ShuffleSelect({
    options,
    value,
    onChange,
}: {
    /** Shuffle names defined on the parent syllabus. */
    options: Array<string>;
    value: Array<string>;
    onChange: (shuffles: Array<string>) => void;
}) {
    if (options.length === 0) return null;

    return (
        <Autocomplete
            multiple
            onChange={(_, next) => onChange(next)}
            options={options}
            renderInput={(params) => (
                <TextField
                    {...params}
                    helperText="ריק = חל על כל השאפלים"
                    label="שאפלים"
                />
            )}
            size="small"
            value={value}
        />
    );
}
