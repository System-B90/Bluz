import AddIcon from "@mui/icons-material/Add";
import BadgeIcon from "@mui/icons-material/Badge";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ClearIcon from "@mui/icons-material/Clear";
import CommentIcon from "@mui/icons-material/Comment";
import EditIcon from "@mui/icons-material/Edit";
import PhoneIcon from "@mui/icons-material/Phone";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { Dayjs } from "dayjs";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo, useState } from "react";

import { Outsider } from "@/api-shared/types/outsider";
import { VCardQrCode } from "@/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode";

type OutsiderFormProps = {
    isCreating: boolean;
    onCancel: () => void;
    onSave: (payload: {
        comment?: string;
        idNumber?: string;
        name: string;
        personalNumber?: string;
        phone: string;
        releaseDate?: string;
    }) => void;
    selectedOutsider: null | Outsider;
};

export function OutsiderForm({
    isCreating,
    onCancel,
    onSave,
    selectedOutsider,
}: OutsiderFormProps)
{
    const { enqueueSnackbar } = useSnackbar();

    const [ name, setName ] = useState(selectedOutsider?.name ?? "");
    const [ phone, setPhone ] = useState(selectedOutsider?.phone ?? "");
    const [ personalNumber, setPersonalNumber ] = useState(
        selectedOutsider?.personalNumber ?? "",
    );
    const [ idNumber, setIdNumber ] = useState(selectedOutsider?.idNumber ?? "");
    const [ releaseDate, setReleaseDate ] = useState<Dayjs | null>(
        selectedOutsider?.releaseDate
            ? dayjs(selectedOutsider.releaseDate)
            : null,
    );
    const [ comment, setComment ] = useState(selectedOutsider?.comment ?? "");

    // State resets are handled by the parent via key={selectedOutsider?.id}
    // which remounts this component when the selection changes.

    const isPhoneValid = useMemo(() =>
    {
        if (!phone) return true;
        return /^\+?[0-9\s-]{7,20}$/.test(phone);
    }, [ phone ]);

    const personalNumberWarning = useMemo(() =>
    {
        if (!personalNumber.trim())
        {
            return "שימו לב: מספר אישי לא הוגדר";
        }
        if (!/^\d{7}$/.test(personalNumber))
        {
            return "שימו לב: מספר אישי צריך להכיל בדיוק 7 ספרות";
        }
        return "";
    }, [ personalNumber ]);

    const idNumberWarning = useMemo(() =>
    {
        if (!idNumber.trim())
        {
            return "שימו לב: ת.ז. לא הוגדרה";
        }
        if (!/^\d{9}$/.test(idNumber))
        {
            return "שימו לב: ת.ז. צריכה להכיל בדיוק 9 ספרות";
        }
        return "";
    }, [ idNumber ]);

    const handleSubmit = useCallback(
        (e: React.FormEvent) =>
        {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedPhone = phone.trim();

            if (!trimmedName)
            {
                enqueueSnackbar("שם איש חוץ הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!trimmedPhone)
            {
                enqueueSnackbar("מספר טלפון הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!isPhoneValid)
            {
                enqueueSnackbar("מספר טלפון לא תקין", { variant: "warning" });
                return;
            }

            onSave({
                comment: comment.trim() || undefined,
                idNumber: idNumber.trim() || undefined,
                name: trimmedName,
                personalNumber: personalNumber.trim() || undefined,
                phone: trimmedPhone,
                releaseDate:
                    releaseDate && releaseDate.isValid()
                        ? releaseDate.toISOString()
                        : undefined,
            });
        },
        [
            name,
            phone,
            isPhoneValid,
            comment,
            idNumber,
            personalNumber,
            releaseDate,
            onSave,
            enqueueSnackbar,
        ],
    );

    const showForm = isCreating || selectedOutsider !== null;

    return (
        <Box
            component="form"
            onSubmit={ handleSubmit }
            sx={ {
                flex: 1,
                minWidth: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px",
                p: 3,
                boxShadow: (theme) =>
                    theme.palette.mode === "light"
                        ? `0 8px 24px rgb(${theme.vars.palette.primary.mainChannel} / 0.04)`
                        : "0 8px 24px rgba(0, 0, 0, 0.2)",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                opacity: showForm ? 1 : 0.5,
                transition: "opacity 0.3s ease",
            } }
        >
            <Box
                sx={ {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    gap: 2,
                } }
            >
                <Box alignItems="center" display="flex" gap={ 1.5 }>
                    <Box
                        sx={ {
                            p: 1,
                            borderRadius: "10px",
                            bgcolor: isCreating
                                ? "secondary.light"
                                : "primary.light",
                            color: isCreating
                                ? "secondary.contrastText"
                                : "primary.contrastText",
                            display: "flex",
                            alignItems: "center",
                        } }
                    >
                        { isCreating ? (
                            <AddIcon className="text-[20px]" />
                        ) : (
                            <EditIcon className="text-[20px]" />
                        ) }
                    </Box>
                    <Box>
                        <Typography
                            sx={ {
                                fontWeight: 800,
                                fontSize: "1.1rem",
                                color: "text.primary",
                            } }
                        >
                            { isCreating
                                ? "הוספת איש חוץ חדש"
                                : selectedOutsider
                                    ? "עריכת פרטי איש חוץ"
                                    : "פרטי איש חוץ" }
                        </Typography>
                        <Typography
                            sx={ {
                                fontSize: "0.75rem",
                                color: "text.secondary",
                            } }
                        >
                            { isCreating
                                ? "מלא את הטופס ליצירת איש חוץ חדש"
                                : selectedOutsider
                                    ? "עדכן את פרטי איש החוץ הנוכחי"
                                    : "בחר איש חוץ מהרשימה לעריכה" }
                        </Typography>
                    </Box>
                </Box>
                { !isCreating && selectedOutsider ? (
                    <VCardQrCode
                        comment={ comment }
                        idNumber={ idNumber }
                        name={ name }
                        personalNumber={ personalNumber }
                        phone={ phone }
                    />
                ) : null }
            </Box>

            { !showForm ? (
                <Box className="m-auto py-12">
                    <Typography
                        sx={ {
                            color: "text.secondary",
                            fontSize: "0.85rem",
                            textAlign: "center",
                        } }
                    >
                        בחר איש חוץ מהרשימה או לחץ על הוספת איש חוץ
                    </Typography>
                </Box>
            ) : (
                <>
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
                            placeholder="לדוגמה: פרופ׳ ישראל ישראלי"
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

                    {/* Actions */ }
                    <Box display="flex" gap={ 1.5 } mt={ 1 }>
                        <Button
                            color={ isCreating ? "secondary" : "primary" }
                            sx={ {
                                flex: 1,
                                borderRadius: "10px",
                                py: 1,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                            } }
                            type="submit"
                            variant="contained"
                        >
                            { isCreating ? "צור איש חוץ" : "עדכן איש חוץ" }
                        </Button>
                        <Button
                            color="inherit"
                            onClick={ onCancel }
                            startIcon={ <ClearIcon /> }
                            sx={ {
                                borderRadius: "10px",
                                py: 1,
                                fontWeight: 700,
                                fontSize: "0.82rem",
                            } }
                            variant="outlined"
                        >
                            ביטול
                        </Button>
                    </Box>
                </>
            ) }
        </Box>
    );
}
