import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BedtimeIcon from "@mui/icons-material/Bedtime";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import { Box, Typography } from "@mui/material";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback } from "react";

import { useSettings } from "@/components/base/SettingsProvider";
import { PrayerSettings as IPrayerSettings } from "@/api-shared/types/settings/prayer";

export function PrayerSettings() {
    const { prayerTimes, updatePrayerTime } = useSettings();

    const handleTimeChange = useCallback(
        (key: keyof IPrayerSettings, newValue: Dayjs | null) => {
            if (newValue && newValue.isValid()) {
                // Instantly trigger auto-save optimistic dispatch & background API save
                updatePrayerTime(key, newValue);
            }
        },
        [updatePrayerTime],
    );

    const getDayjsValue = useCallback((val: any) => {
        if (!val) return null;
        return dayjs(val);
    }, []);

    // Configuration for thematic rows
    const rows = [
        {
            key: "shacharit" as keyof IPrayerSettings,
            label: "שחרית",
            icon: <WbTwilightIcon sx={{ color: "#FF9F43" }} />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "mincha" as keyof IPrayerSettings,
            label: "מנחה",
            icon: <WbSunnyIcon sx={{ color: "#FFC107" }} />,
            bgColor: "rgba(255, 193, 7, 0.12)",
        },
        {
            key: "arvit" as keyof IPrayerSettings,
            label: "ערבית",
            icon: <BedtimeIcon sx={{ color: "#9B5DE5" }} />,
            bgColor: "rgba(155, 93, 229, 0.12)",
        },
    ];

    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? "0 8px 24px rgba(103, 200, 221, 0.04)"
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                height: "100%",
            }}
        >
            {/* Section Header */}
            <Box display="flex" alignItems="center" gap={1.5}>
                <Box
                    sx={{
                        p: 1,
                        borderRadius: "10px",
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <AccessTimeIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            fontFamily: "Assistant, sans-serif",
                            color: "text.primary",
                        }}
                    >
            זמני תפילות
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                            fontFamily: "Assistant, sans-serif",
                        }}
                    >
            זמני תפילות קבועים המשתקפים ביומן
                    </Typography>
                </Box>
            </Box>

            {/* TimePickers List */}
            <Box display="flex" flexDirection="column" gap={2.5}>
                {rows.map((row) => (
                    <Box
                        key={row.key}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                            p: 1.5,
                            borderRadius: "12px",
                            border: "1px solid",
                            borderColor: "action.hover",
                            bgcolor: "rgba(255,255,255,0.01)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                borderColor: "primary.main",
                                bgcolor: "action.hover",
                            },
                        }}
                    >
                        {/* Circular Icon Tag */}
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: row.bgColor,
                                flexShrink: 0,
                            }}
                        >
                            {row.icon}
                        </Box>

                        {/* Picker Control */}
                        <Box sx={{ flexGrow: 1 }}>
                            <TimePicker
                                label={row.label}
                                onChange={(newValue) => handleTimeChange(row.key, newValue)}
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        fullWidth: true,
                                        sx: {
                                            "& .MuiOutlinedInput-root": {
                                                borderRadius: "8px",
                                                bgcolor: "transparent",
                                            },
                                        },
                                    },
                                }}
                                value={getDayjsValue(prayerTimes?.[row.key])}
                            />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

