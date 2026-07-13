import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import WeekendIcon from "@mui/icons-material/Weekend";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback } from "react";

import { useSettings } from "@/components/base/SettingsProvider";

export function DayStartTimeSetting() {
    const {
        dayStartTime,
        updateDayStartTime,
        weekendHomeStartTime,
        updateWeekendHomeStartTime,
    } = useSettings();

    const handleDayStartChange = useCallback(
        (newValue: Dayjs | null) => {
            if (newValue && newValue.isValid()) {
                updateDayStartTime(newValue.format("HH:mm"));
            }
        },
        [updateDayStartTime],
    );

    const handleWeekendHomeStartChange = useCallback(
        (newValue: Dayjs | null) => {
            if (newValue && newValue.isValid()) {
                updateWeekendHomeStartTime(newValue.format("HH:mm"));
            }
        },
        [updateWeekendHomeStartTime],
    );

    const rows = [
        {
            key: "dayStart",
            label: "שעת תחילת יום",
            value: dayStartTime,
            onChange: handleDayStartChange,
            icon: <WbTwilightIcon className="text-[#FF9F43]" />,
            bgColor: "rgba(255, 159, 67, 0.12)",
        },
        {
            key: "weekendHomeStart",
            label: 'שעת תחילת לו"ז אחרי סופ"ש',
            value: weekendHomeStartTime,
            onChange: handleWeekendHomeStartChange,
            icon: <WeekendIcon className="text-[#26A69A]" />,
            bgColor: "rgba(38, 166, 154, 0.12)",
        },
    ];

    return (
        <Box
            sx={(theme) => ({
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`,
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                ...theme.applyStyles("dark", {
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                }),
            })}
        >
            <Box alignItems="center" display="flex" gap={1.5}>
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
                    <AccessTimeIcon className="text-[20px]" />
                </Box>
                <Box>
                    <Typography
                        sx={{
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            color: "text.primary",
                        }}
                    >
                        שעת תחילת יום ברירת מחדל
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: "0.75rem",
                            color: "text.secondary",
                        }}
                    >
                        שעת ההתחלה שממנה נערכים אירועים בגזירת לו&quot;ז מסילבוס
                    </Typography>
                </Box>
            </Box>

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

                        <Box className="grow min-w-0">
                            <TimePicker
                                label={row.label}
                                onChange={row.onChange}
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
                                value={dayjs(row.value, "HH:mm")}
                            />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
