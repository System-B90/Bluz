import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function SettingsFormPlaceholder({ message }: { message: string; })
{
    return (
        <Box className="m-auto py-12">
            <Typography sx={ { color: "text.secondary", fontSize: "0.85rem", textAlign: "center" } }>
                { message }
            </Typography>
        </Box>
    );
}
