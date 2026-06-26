import BadgeIcon from "@mui/icons-material/Badge";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CommentIcon from "@mui/icons-material/Comment";
import PhoneIcon from "@mui/icons-material/Phone";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";

type OutsiderFormFieldsProps = {
    comment: string;
    idNumber: string;
    idNumberWarning: string;
    isPhoneValid: boolean;
    name: string;
    personalNumber: string;
    personalNumberWarning: string;
    phone: string;
    releaseDate: Dayjs | null;
    setComment: (v: string) => void;
    setIdNumber: (v: string) => void;
    setName: (v: string) => void;
    setPersonalNumber: (v: string) => void;
    setPhone: (v: string) => void;
    setReleaseDate: (v: Dayjs | null) => void;
};

export function OutsiderFormFields({
    comment,
    idNumber,
    idNumberWarning,
    isPhoneValid,
    name,
    personalNumber,
    personalNumberWarning,
    phone,
    releaseDate,
    setComment,
    setIdNumber,
    setName,
    setPersonalNumber,
    setPhone,
    setReleaseDate,
}: OutsiderFormFieldsProps) {
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
            } }
        >
            {/* Full Name */ }
            <TextField
                fullWidth
                label="שם מלא"
                onChange={ (e) => setName(e.target.value) }
                placeholder="לדוגמה: שלומי בוטנרו"
                required
                size="small"
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ name }
            />

            {/* Phone */ }
            <TextField
                error={ !isPhoneValid }
                fullWidth
                helperText={
                    !isPhoneValid ? "מספר טלפון לא תקין" : ""
                }
                label="מספר טלפון"
                onChange={ (e) => setPhone(e.target.value) }
                placeholder="לדוגמה: 0501234567"
                required
                size="small"
                slotProps={ {
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <PhoneIcon
                                    fontSize="small"
                                    sx={ {
                                        color: "text.secondary",
                                    } }
                                />
                            </InputAdornment>
                        ),
                    },
                } }
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ phone }
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
            <TextField
                error={
                    !!personalNumberWarning &&
                    personalNumberWarning !==
                    "שימו לב: מספר אישי לא הוגדר"
                }
                fullWidth
                helperText={
                    personalNumberWarning ? (
                        <Box
                            alignItems="center"
                            component="span"
                            display="inline-flex"
                            gap={ 0.5 }
                            sx={ {
                                color: "warning.main",
                                mt: 0.2,
                            } }
                        >
                            <WarningAmberIcon
                                sx={ { fontSize: "14px" } }
                            />
                            <span>{ personalNumberWarning }</span>
                        </Box>
                    ) : (
                        ""
                    )
                }
                label="מספר אישי (7 ספרות)"
                onChange={ (e) =>
                    setPersonalNumber(
                        e.target.value.replace(/\D/g, ""),
                    )
                }
                placeholder="לדוגמה: 9876543"
                size="small"
                slotProps={ {
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <BadgeIcon
                                    fontSize="small"
                                    sx={ {
                                        color: "text.secondary",
                                    } }
                                />
                            </InputAdornment>
                        ),
                    },
                } }
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ personalNumber }
            />

            {/* ID Number */ }
            <TextField
                error={
                    !!idNumberWarning &&
                    idNumberWarning !== "שימו לב: ת.ז. לא הוגדרה"
                }
                fullWidth
                helperText={
                    idNumberWarning ? (
                        <Box
                            alignItems="center"
                            component="span"
                            display="inline-flex"
                            gap={ 0.5 }
                            sx={ {
                                color: "warning.main",
                                mt: 0.2,
                            } }
                        >
                            <WarningAmberIcon
                                sx={ { fontSize: "14px" } }
                            />
                            <span>{ idNumberWarning }</span>
                        </Box>
                    ) : (
                        ""
                    )
                }
                label="תעודת זהות (9 ספרות)"
                onChange={ (e) =>
                    setIdNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="לדוגמה: 123456789"
                size="small"
                slotProps={ {
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <BadgeIcon
                                    fontSize="small"
                                    sx={ {
                                        color: "text.secondary",
                                    } }
                                />
                            </InputAdornment>
                        ),
                    },
                } }
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ idNumber }
            />

            {/* Release Date */ }
            <Box display="flex" flexDirection="column" gap={ 1 }>
                <DatePicker
                    format="DD/MM/YYYY"
                    label="תאריך שחרור"
                    onChange={ (val) => setReleaseDate(val) }
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
                    value={ releaseDate }
                />
                { releaseDate &&
                    releaseDate.isValid() &&
                    releaseDate.isBefore(dayjs(), "day") ? (
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
            <TextField
                fullWidth
                label="הערה"
                multiline
                onChange={ (e) => setComment(e.target.value) }
                placeholder="הערות לגבי המרצה..."
                rows={ 2 }
                size="small"
                slotProps={ {
                    input: {
                        startAdornment: (
                            <InputAdornment
                                position="start"
                                sx={ {
                                    alignSelf: "flex-start",
                                    mt: 1,
                                } }
                            >
                                <CommentIcon
                                    fontSize="small"
                                    sx={ {
                                        color: "text.secondary",
                                    } }
                                />
                            </InputAdornment>
                        ),
                    },
                } }
                sx={ {
                    "& .MuiOutlinedInput-root": {
                        borderRadius: "10px",
                    },
                } }
                value={ comment }
            />
        </Box>
    );
}
