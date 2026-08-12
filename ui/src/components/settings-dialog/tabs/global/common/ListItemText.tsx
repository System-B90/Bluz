import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function SettingsListItemTextPrimary({ value }: { value: string; })
{
    return (
        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={ 1 }>
            <Typography
                component="span"
                sx={ {
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "text.primary",
                } }
            >
                { value }
            </Typography>
        </Box>
    );
}

export function SettingsListItemTextSecondary({ value }: { value: null | string | undefined; })
{
    return (
        value ? <Typography
            component="span"
            sx={ {
                fontSize: "0.75rem",
                color: "text.secondary",
            } }
        >
            { value }
        </Typography> : null
    );
}
