import { Box } from "@mui/material";

import { CourseSettings } from "@/components/settings-dialog/tabs/global/course-settings";
import { PrayerSettings } from "@/components/settings-dialog/tabs/global/PrayerSettings";

export function GlobalSettings() {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <PrayerSettings />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <CourseSettings />
            </Box>
        </Box>
    );
}

