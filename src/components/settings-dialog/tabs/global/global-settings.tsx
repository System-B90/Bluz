import PrayerSettings from "@/components/settings-dialog/tabs/global/prayer-settings";
import { Box, Typography } from "@mui/material";

export default function GlobalSettings()
{
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                הגדרות כלליות
            </Typography>

            <Box display={ 'flex' }>
                <PrayerSettings />
            </Box>
        </Box>
    );
}
