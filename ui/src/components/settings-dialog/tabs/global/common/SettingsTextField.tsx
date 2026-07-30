import TextField, { TextFieldProps } from "@mui/material/TextField";

/**
 * `TextField` with the settings-form look: small, full width, and the 10px
 * input radius that every settings field repeated inline. Anything can still
 * be overridden per call, and a caller-supplied `sx` merges on top rather
 * than replacing the radius. See #191.
 */
export function SettingsTextField({ sx, ...props }: TextFieldProps) {
    return (
        <TextField
            fullWidth
            size="small"
            {...props}
            sx={[
                { "& .MuiOutlinedInput-root": { borderRadius: "10px" } },
                // `sx` accepts arrays, objects or functions; spreading an
                // array keeps all three working.
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
        />
    );
}
