import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function SettingsEmptyState({ message }: { message: string; })
{
    return (
        <Box sx={ { m: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 } }>
            <Typography sx={ { color: "text.secondary", fontSize: "0.85rem" } }>
                { message }
            </Typography>
        </Box>
    );
}
