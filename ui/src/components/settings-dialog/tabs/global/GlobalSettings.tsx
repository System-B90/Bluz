import { Box, Typography } from "@mui/material";

import CourseSettings from "@/components/settings-dialog/tabs/global/course-settings";
import PrayerSettings from "@/components/settings-dialog/tabs/global/PrayerSettings";

export default function GlobalSettings()
{
    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                הגדרות כלליות
            </Typography>

            <Box display={ 'flex' } gap={ 2 }>
                <PrayerSettings />
                <CourseSettings />
            </Box>
        </Box>
    );
}
