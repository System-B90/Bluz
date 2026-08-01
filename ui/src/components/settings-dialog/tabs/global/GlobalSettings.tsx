import Box from "@mui/material/Box";

import { CalendarHoursSetting } from "@/components/settings-dialog/tabs/global/CalendarHoursSetting";
import { DayStartTimeSetting } from "@/components/settings-dialog/tabs/global/DayStartTimeSetting";
import { MealTimesSetting } from "@/components/settings-dialog/tabs/global/MealTimesSetting";
import { PrayerSettings } from "@/components/settings-dialog/tabs/global/PrayerSettings";

export function GlobalSettings()
{
    return (
        <Box
            sx={ {
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                width: "100%",
            } }
        >
            <Box sx={ { flex: "1 1 340px", minWidth: 300 } }>
                <PrayerSettings />
            </Box>
            <Box sx={ { flex: "1 1 340px", minWidth: 300 } }>
                <DayStartTimeSetting />
            </Box>
            <Box sx={ { flex: "1 1 340px", minWidth: 300 } }>
                <MealTimesSetting />
            </Box>
            <Box sx={ { flex: "1 1 340px", minWidth: 300 } }>
                <CalendarHoursSetting />
            </Box>
        </Box>
    );
}
