import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback } from "react";

import { useSettings } from "@/components/base/SettingsProvider";

export function DayStartTimeSetting() {
    const { dayStartTime, updateDayStartTime } = useSettings();

    const handleChange = useCallback(
        (newValue: Dayjs | null) => {
            if (newValue && newValue.isValid()) {
                updateDayStartTime(newValue.format("HH:mm"));
            }
        },
        [updateDayStartTime],
    );

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
                    <WbTwilightIcon className="text-[20px]" />
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
                        שעת ההתחלה שממנה נערמים אירועים בגזירת לו&quot;ז מסילבוס
                    </Typography>
                </Box>
            </Box>

            <TimePicker
                label="שעת תחילת יום"
                onChange={handleChange}
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
                value={dayjs(dayStartTime, "HH:mm")}
            />
        </Box>
    );
}
