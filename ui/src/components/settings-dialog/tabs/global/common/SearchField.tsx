import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";

export type SettingsSearchFieldProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
};

export function SettingsSearchField({ value, onChange, placeholder }: SettingsSearchFieldProps)
{
    return (
        <TextField
            onChange={ (e) => onChange(e.target.value) }
            placeholder={ placeholder }
            size="small"
            slotProps={ {
                input: {
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon fontSize="small" sx={ { color: "text.secondary" } } />
                        </InputAdornment>
                    ),
                },
            } }
            sx={ { "& .MuiOutlinedInput-root": { borderRadius: "10px" } } }
            value={ value }
        />
    );
}
