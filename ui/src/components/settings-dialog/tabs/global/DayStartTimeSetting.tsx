import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import WeekendIcon from "@mui/icons-material/Weekend";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useMemo } from "react";

import { useSettings } from "@/components/base/SettingsProvider";

type DayStartTimeSettingProps = {
    isShrunk?: boolean;
    onToggleShrink?: () => void;
};

export function DayStartTimeSetting({
    isShrunk = false,
    onToggleShrink,
}: DayStartTimeSettingProps) {
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

    const rows = useMemo(() => [
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
    ], [dayStartTime, weekendHomeStartTime, handleDayStartChange, handleWeekendHomeStartChange]);

    const shrunkElements = useMemo(() => {
        return rows.map((row) => {
            const val = row.value;
            const timeStr = val || "--:--";
            return (
                <Tooltip
                    key={row.key}
                    placement="left"
                    title={row.label}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.5,
                            p: 0.8,
                            borderRadius: "12px",
                            border: "1px solid",
                            borderColor: "action.hover",
                            bgcolor: "rgba(255,255,255,0.01)",
                            transition: "all 0.2s ease",
                            width: 48,
                            height: 64,
                            justifyContent: "center",
                            "&:hover": {
                                borderColor: "primary.main",
                                bgcolor: "action.hover",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
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
                        <Typography
                            sx={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: "text.primary",
                            }}
                        >
                            {timeStr}
                        </Typography>
                    </Box>
                </Tooltip>
            );
        });
    }, [rows]);

    const expandedElements = useMemo(() => {
        return rows.map((row) => (
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
        ));
    }, [rows]);

    return (
        <Box
            sx={(theme) => ({
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: isShrunk ? 1.5 : 3,
                boxShadow: `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`,
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: isShrunk ? 2.5 : 3,
                alignItems: isShrunk ? "center" : "stretch",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                ...theme.applyStyles("dark", {
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                }),
            })}
        >
            {/* Section Header */}
            {isShrunk ? (
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="column"
                    gap={2}
                    width="100%"
                >
                    {!!onToggleShrink && (
                        <Tooltip placement="left" title="הרחב פאנל">
                            <IconButton
                                onClick={onToggleShrink}
                                size="small"
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                }}
                            >
                                <ChevronLeftIcon className="text-[18px]" />
                            </IconButton>
                        </Tooltip>
                    )}
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
                </Box>
            ) : (
                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                    width="100%"
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
                    {!!onToggleShrink && (
                        <Tooltip placement="left" title="כווץ פאנל">
                            <IconButton
                                onClick={onToggleShrink}
                                size="small"
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                }}
                            >
                                <ChevronRightIcon className="text-[18px]" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            )}

            {/* TimePickers List */}
            {isShrunk ? (
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="column"
                    gap={2}
                    width="100%"
                >
                    {shrunkElements}
                </Box>
            ) : (
                <Box display="flex" flexDirection="column" gap={2.5}>
                    {expandedElements}
                </Box>
            )}
        </Box>
    );
}
