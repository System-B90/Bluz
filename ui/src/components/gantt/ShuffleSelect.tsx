import Autocomplete from "@mui/material/Autocomplete";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ShuffleDescriptions } from "@/api-shared/gantt/shuffle-names";

/**
 * Multi-select for tagging a Gantt module/event with shuffle (student group)
 * names defined on the parent syllabus. An empty selection means the item
 * applies to all shuffles. Each option shows its Hive student-group
 * description, when it has one.
 */
export function ShuffleSelect({
    options,
    descriptions = {},
    value,
    onChange,
}: {
    /** Shuffle names defined on the parent syllabus. */
    options: Array<string>;
    /** The syllabus' shuffle name → description map. */
    descriptions?: ShuffleDescriptions;
    value: Array<string>;
    onChange: (shuffles: Array<string>) => void;
})
{
    if (options.length === 0) return (
        <Typography color="text.secondary" variant="body1">
            לא הוגדרו שאפלים במקצוע
        </Typography>
    );

    return (
        <Autocomplete
            multiple
            onChange={ (_, next) => onChange(next) }
            options={ options }
            renderInput={ (params) => (
                <TextField
                    { ...params }
                    helperText="ריק = חל על כל השאפלים"
                    label="שאפלים"
                />
            ) }
            renderOption={ ({ key, ...props }, option) => (
                <li key={ key } { ...props }>
                    <ListItemText
                        primary={ option }
                        secondary={ descriptions[option] }
                    />
                </li>
            ) }
            size="small"
            value={ value }
        />
    );
}
