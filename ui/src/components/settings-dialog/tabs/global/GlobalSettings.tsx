import { Box } from "@mui/material";
import { useState } from "react";

import { CourseSettings } from "@/components/settings-dialog/tabs/global/course-settings";
import { PrayerSettings } from "@/components/settings-dialog/tabs/global/PrayerSettings";

export function GlobalSettings() {
    const [isPrayerShrunk, setIsPrayerShrunk] = useState(false);

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
            <Box
                sx={{
                    flex: isPrayerShrunk ? "0 0 auto" : 1,
                    width: isPrayerShrunk ? 80 : "auto",
                    minWidth: isPrayerShrunk ? 80 : 280,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <PrayerSettings isShrunk={isPrayerShrunk} onToggleShrink={() => setIsPrayerShrunk(!isPrayerShrunk)} />
            </Box>
            <Box
                sx={{
                    flex: isPrayerShrunk ? 2.6 : 1.6,
                    minWidth: 0,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <CourseSettings />
            </Box>
        </Box>
    );
}
