import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { Dayjs } from "dayjs";
import { ReactNode } from "react";

export type TimeSettingRow = {
    key: string;
    label: string;
    value: Dayjs | null;
    onChange: (newValue: Dayjs | null) => void;
    icon: ReactNode;
    bgColor: string;
};

export type BaseTimeSettingsCardProps = {
    title: string;
    description: string;
    icon?: ReactNode;
    isShrunk?: boolean;
    onToggleShrink?: () => void;
    rows: Array<TimeSettingRow>;
    sx?: SxProps<Theme>;
};

export function BaseTimeSettingsCard({
    title,
    description,
    icon = <AccessTimeIcon className="text-[20px]" />,
    isShrunk = false,
    onToggleShrink,
    rows,
    sx,
}: BaseTimeSettingsCardProps)
{
    return (
        <Box
            sx={ [
                (theme) => ({
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "16px",
                    p: isShrunk ? 1.5 : 3,
                    boxShadow: `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`,
                    bgcolor: "background.paper",
                    display: "flex",
                    flexDirection: "column",
                    gap: isShrunk ? 1.5 : 2,
                    alignItems: isShrunk ? "center" : "stretch",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    ...theme.applyStyles("dark", {
                        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                    }),
                }),
                ...(Array.isArray(sx) ? sx : [ sx ]),
            ] }
        >
            {/* Section Header */ }
            { isShrunk ? (
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="column"
                    gap={ 2 }
                    width="100%"
                >
                    { !!onToggleShrink && (
                        <Tooltip placement="left" title="הרחבת הפאנל">
                            <IconButton
                                onClick={ onToggleShrink }
                                size="small"
                                sx={ {
                                    border: "1px solid",
                                    borderColor: "divider",
                                } }
                            >
                                <ChevronLeftIcon className="text-[18px]" />
                            </IconButton>
                        </Tooltip>
                    ) }
                    <Box
                        sx={ {
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: "primary.light",
                            color: "primary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        } }
                    >
                        { icon }
                    </Box>
                </Box>
            ) : (
                <Box
                    alignItems="center"
                    display="flex"
                    justifyContent="space-between"
                    width="100%"
                >
                    <Box alignItems="center" display="flex" gap={ 1.5 }>
                        <Box
                            sx={ {
                                p: 1,
                                borderRadius: "10px",
                                bgcolor: "primary.light",
                                color: "primary.contrastText",
                                display: "flex",
                                alignItems: "center",
                            } }
                        >
                            { icon }
                        </Box>
                        <Box>
                            <Typography
                                sx={ {
                                    fontWeight: 800,
                                    fontSize: "1.1rem",
                                    color: "text.primary",
                                } }
                            >
                                { title }
                            </Typography>
                            <Typography
                                sx={ {
                                    fontSize: "0.75rem",
                                    color: "text.secondary",
                                } }
                            >
                                { description }
                            </Typography>
                        </Box>
                    </Box>
                    { !!onToggleShrink && (
                        <Tooltip placement="left" title="כווץ פאנל">
                            <IconButton
                                onClick={ onToggleShrink }
                                size="small"
                                sx={ {
                                    border: "1px solid",
                                    borderColor: "divider",
                                } }
                            >
                                <ChevronRightIcon className="text-[18px]" />
                            </IconButton>
                        </Tooltip>
                    ) }
                </Box>
            ) }

            {/* TimePickers List */ }
            { isShrunk ? (
                <Box
                    alignItems="center"
                    display="flex"
                    flexDirection="column"
                    gap={ 2 }
                    width="100%"
                >
                    { rows.map((row) =>
                    {
                        const val = row.value;
                        const timeStr = val && val.isValid() ? val.format("HH:mm") : "--:--";
                        return (
                            <Tooltip
                                key={ row.key }
                                placement="left"
                                title={ row.label }
                            >
                                <Box
                                    sx={ {
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
                                    } }
                                >
                                    <Box
                                        sx={ {
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            bgcolor: row.bgColor,
                                            flexShrink: 0,
                                        } }
                                    >
                                        { row.icon }
                                    </Box>
                                    <Typography
                                        sx={ {
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            color: "text.primary",
                                        } }
                                    >
                                        { timeStr }
                                    </Typography>
                                </Box>
                            </Tooltip>
                        );
                    }) }
                </Box>
            ) : (
                <Box display="flex" flexDirection="column" gap={ 1 }>
                    { rows.map((row) => (
                        <Box
                            key={ row.key }
                            sx={ {
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
                            } }
                        >
                            {/* Circular Icon Tag */ }
                            <Box
                                sx={ {
                                    width: 42,
                                    height: 42,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: row.bgColor,
                                    flexShrink: 0,
                                } }
                            >
                                { row.icon }
                            </Box>

                            {/* Picker Control */ }
                            <Box className="grow min-w-0">
                                <TimePicker
                                    label={ row.label }
                                    onChange={ row.onChange }
                                    slotProps={ {
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
                                    } }
                                    value={ row.value }
                                />
                            </Box>
                        </Box>
                    )) }
                </Box>
            ) }
        </Box>
    );
}
