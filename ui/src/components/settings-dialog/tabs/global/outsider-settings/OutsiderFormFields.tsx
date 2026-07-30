import BadgeIcon from "@mui/icons-material/Badge";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CommentIcon from "@mui/icons-material/Comment";
import PhoneIcon from "@mui/icons-material/Phone";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { ReactNode } from "react";

import { SettingsTextField } from "@/components/settings-dialog/tabs/global/common/SettingsTextField";
import { OutsiderValues } from "@/components/settings-dialog/tabs/global/outsider-settings/values";

type OutsiderFormFieldsProps = {
    values: OutsiderValues;
    setValue: <TKey extends keyof OutsiderValues>(
        key: TKey,
        value: OutsiderValues[TKey],
    ) => void;
    idNumberWarning: string;
    isPhoneValid: boolean;
    personalNumberWarning: string;
};

const startIcon = (icon: ReactNode, alignTop = false) => ({
    startAdornment: (
        <InputAdornment
            position="start"
            sx={ alignTop ? { alignSelf: "flex-start", mt: 1 } : undefined }
        >
            { icon }
        </InputAdornment>
    ),
});

/** Warning text with its icon, or "" when there is nothing to warn about. */
function warningHelperText(warning: string)
{
    if (!warning) return "";
    return (
        <Box
            alignItems="center"
            component="span"
            display="inline-flex"
            gap={ 0.5 }
            sx={ { color: "warning.main", mt: 0.2 } }
        >
            <WarningAmberIcon sx={ { fontSize: "14px" } } />
            <span>{ warning }</span>
        </Box>
    );
}

const iconSx = { color: "text.secondary" };

export function OutsiderFormFields({
    values,
    setValue,
    idNumberWarning,
    isPhoneValid,
    personalNumberWarning,
}: OutsiderFormFieldsProps)
{
    return (
        <Box
            sx={ {
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                maxHeight: 340,
                overflowY: "auto",
                pl: 0.5,
                pr: 0.5,
                pt: 2,
                mt: -2,
            } }
        >
            {/* Full Name */ }
            <SettingsTextField
                label="שם מלא"
                onChange={ (e) => setValue("name", e.target.value) }
                placeholder="לדוגמה: שלומי בוטנרו"
                required
                value={ values.name }
            />

            {/* Phone */ }
            <SettingsTextField
                error={ !isPhoneValid }
                helperText={ !isPhoneValid ? "מספר טלפון לא תקין" : "" }
                label="מספר טלפון"
                onChange={ (e) => setValue("phone", e.target.value) }
                placeholder="לדוגמה: 0501234567"
                required
                slotProps={ {
                    input: startIcon(
                        <PhoneIcon fontSize="small" sx={ iconSx } />,
                    ),
                } }
                value={ values.phone }
            />

            <Divider className="my-1">
                <Typography
                    sx={ {
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "text.secondary",
                    } }
                >
                    פרטים מזהים ושחרור
                </Typography>
            </Divider>

            {/* Personal Number */ }
            <SettingsTextField
                error={
                    !!personalNumberWarning &&
                    personalNumberWarning !== "שימו לב: מספר אישי לא הוגדר"
                }
                helperText={ warningHelperText(personalNumberWarning) }
                label="מספר אישי (7 ספרות)"
                onChange={ (e) =>
                    setValue("personalNumber", e.target.value.replace(/\D/g, ""))
                }
                placeholder="לדוגמה: 9876543"
                slotProps={ {
                    input: startIcon(
                        <BadgeIcon fontSize="small" sx={ iconSx } />,
                    ),
                } }
                value={ values.personalNumber }
            />

            {/* ID Number */ }
            <SettingsTextField
                error={
                    !!idNumberWarning &&
                    idNumberWarning !== "שימו לב: ת.ז. לא הוגדרה"
                }
                helperText={ warningHelperText(idNumberWarning) }
                label="תעודת זהות (9 ספרות)"
                onChange={ (e) =>
                    setValue("idNumber", e.target.value.replace(/\D/g, ""))
                }
                placeholder="לדוגמה: 123456789"
                slotProps={ {
                    input: startIcon(
                        <BadgeIcon fontSize="small" sx={ iconSx } />,
                    ),
                } }
                value={ values.idNumber }
            />

            {/* Release Date */ }
            <Box display="flex" flexDirection="column" gap={ 1 }>
                <DatePicker
                    format="DD/MM/YYYY"
                    label="תאריך שחרור"
                    onChange={ (val) => setValue("releaseDate", val) }
                    slotProps={ {
                        textField: {
                            size: "small",
                            sx: {
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "10px",
                                },
                            },
                        },
                    } }
                    value={ values.releaseDate }
                />
                { values.releaseDate &&
                    values.releaseDate.isValid() &&
                    values.releaseDate.isBefore(dayjs(), "day") ? (
                        <Box
                            alignItems="center"
                            display="flex"
                            gap={ 0.5 }
                            sx={ { color: "success.main" } }
                        >
                            <CheckCircleIcon className="text-[16px]" />
                            <Typography
                                sx={ { fontWeight: 700 } }
                                variant="caption"
                            >
                            סטטוס: משוחרר
                            </Typography>
                        </Box>
                    ) : null }
            </Box>

            {/* Comment */ }
            <SettingsTextField
                label="הערה"
                multiline
                onChange={ (e) => setValue("comment", e.target.value) }
                placeholder="הערות לגבי המרצה..."
                rows={ 2 }
                slotProps={ {
                    input: startIcon(
                        <CommentIcon fontSize="small" sx={ iconSx } />,
                        true,
                    ),
                } }
                value={ values.comment }
            />
        </Box>
    );
}
