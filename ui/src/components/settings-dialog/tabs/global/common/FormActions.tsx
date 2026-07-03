import ClearIcon from "@mui/icons-material/Clear";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

type SettingsFormActionsProps = {
    submitLabel: string;
    submitColor?: "primary" | "secondary";
    onCancel: () => void;
};

export function SettingsFormActions({ submitLabel, submitColor = "primary", onCancel }: SettingsFormActionsProps)
{
    return (
        <Box display="flex" gap={ 1.5 } mt={ 1 }>
            <Button
                color={ submitColor }
                sx={ {
                    flex: 1,
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                } }
                type="submit"
                variant="contained"
            >
                { submitLabel }
            </Button>
            <Button
                color="inherit"
                onClick={ onCancel }
                startIcon={ <ClearIcon /> }
                sx={ {
                    borderRadius: "10px",
                    py: 1,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                } }
                variant="outlined"
            >
                ביטול
            </Button>
        </Box>
    );
}
