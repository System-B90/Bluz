import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { renderMultiSectionDigitalClockTimeView } from "@mui/x-date-pickers/timeViewRenderers";
import { Dayjs } from "dayjs";
import { ReactNode } from "react";

import { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

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
    rows: Array<TimeSettingRow>;
    /** Locks the pickers, e.g. while a past iteration is being viewed. */
    disabled?: boolean;
    sx?: SxProps<Theme>;
};

export function BaseTimeSettingsCard({
    title,
    description,
    icon = <AccessTimeIcon className="text-[20px]" />,
    rows,
    disabled = false,
    sx,
}: BaseTimeSettingsCardProps)
{
    return (
        <Box
            sx={ [
                {
                    ...settingsCardSx,
                    p: 3,
                    gap: 2,
                    alignItems: "stretch",
                },
                ...(Array.isArray(sx) ? sx : [ sx ]),
            ] }
        >
            {/* Section Header */ }
            <Box
                alignItems="center"
                display="flex"
                gap={ 1.5 }
                width="100%"
            >
                <Box sx={ iconBadgeSx("primary") }>
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

            {/* TimePickers List */ }
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
                                disabled={ disabled }
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
                                // Hours/minutes side by side instead of
                                // the default single scrollable list.
                                viewRenderers={ {
                                    hours: renderMultiSectionDigitalClockTimeView,
                                    minutes: renderMultiSectionDigitalClockTimeView,
                                } }
                            />
                        </Box>
                    </Box>
                )) }
            </Box>
        </Box>
    );
}
