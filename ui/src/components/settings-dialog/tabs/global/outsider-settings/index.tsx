"use client";
import AddIcon from "@mui/icons-material/Add";
import BadgeIcon from "@mui/icons-material/Badge";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ClearIcon from "@mui/icons-material/Clear";
import CommentIcon from "@mui/icons-material/Comment";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { Outsider } from "@/api-shared/types/outsider";
import { useOutsiders } from "@/components/base/OutsidersProvider";

export function OutsiderSettings() {
    const { outsiders, addOutsider, updateOutsider, deleteOutsider } =
        useOutsiders();
    const { enqueueSnackbar } = useSnackbar();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedOutsider, setSelectedOutsider] = useState<null | Outsider>(
        null,
    );
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [personalNumber, setPersonalNumber] = useState("");
    const [idNumber, setIdNumber] = useState("");
    const [releaseDate, setReleaseDate] = useState<Dayjs | null>(null);
    const [comment, setComment] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const filteredOutsiders = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return outsiders;
        return outsiders.filter(
            (o) =>
                o.name.toLowerCase().includes(query) ||
                o.phone.includes(query) ||
                (o.personalNumber && o.personalNumber.includes(query)) ||
                (o.idNumber && o.idNumber.includes(query)),
        );
    }, [outsiders, searchQuery]);

    const populateFormFromOutsider = useCallback((outsider: Outsider) => {
        setSelectedOutsider(outsider);
        setIsCreating(false);
        setName(outsider.name);
        setPhone(outsider.phone);
        setPersonalNumber(outsider.personalNumber || "");
        setIdNumber(outsider.idNumber || "");
        setReleaseDate(
            outsider.releaseDate ? dayjs(outsider.releaseDate) : null,
        );
        setComment(outsider.comment || "");
    }, []);

    const handleStartCreate = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(true);
        setName("");
        setPhone("");
        setPersonalNumber("");
        setIdNumber("");
        setReleaseDate(null);
        setComment("");
    }, []);

    const handleCancelEdit = useCallback(() => {
        setSelectedOutsider(null);
        setIsCreating(false);
        setName("");
        setPhone("");
        setPersonalNumber("");
        setIdNumber("");
        setReleaseDate(null);
        setComment("");
    }, []);

    // Form warnings / validations
    const isPhoneValid = useMemo(() => {
        if (!phone) return true;
        // Loose phone validation: at least 7 digits, digits/spaces/hyphens/pluses allowed
        return /^\+?[0-9\s-]{7,20}$/.test(phone);
    }, [phone]);

    const personalNumberWarning = useMemo(() => {
        if (!personalNumber.trim()) {
            return "שימו לב: מספר אישי לא הוגדר";
        }
        if (!/^\d{7}$/.test(personalNumber)) {
            return "שימו לב: מספר אישי צריך להכיל בדיוק 7 ספרות";
        }
        return "";
    }, [personalNumber]);

    const idNumberWarning = useMemo(() => {
        if (!idNumber.trim()) {
            return "שימו לב: ת.ז. לא הוגדרה";
        }
        if (!/^\d{9}$/.test(idNumber)) {
            return "שימו לב: ת.ז. צריכה להכיל בדיוק 9 ספרות";
        }
        return "";
    }, [idNumber]);

    const handleSave = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedPhone = phone.trim();

            if (!trimmedName) {
                enqueueSnackbar("שם איש חוץ הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!trimmedPhone) {
                enqueueSnackbar("מספר טלפון הוא שדה חובה", {
                    variant: "warning",
                });
                return;
            }
            if (!isPhoneValid) {
                enqueueSnackbar("מספר טלפון לא תקין", { variant: "warning" });
                return;
            }

            const payloadData = {
                name: trimmedName,
                phone: trimmedPhone,
                personalNumber: personalNumber.trim() || undefined,
                idNumber: idNumber.trim() || undefined,
                releaseDate:
                    releaseDate && releaseDate.isValid()
                        ? releaseDate.toISOString()
                        : undefined,
                comment: comment.trim() || undefined,
            };

            if (isCreating) {
                try {
                    await addOutsider(payloadData);
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה ביצירת איש חוץ",
                        err,
                    );
                }
            } else if (selectedOutsider) {
                try {
                    await updateOutsider({
                        ...selectedOutsider,
                        ...payloadData,
                    });
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה בעדכון איש חוץ",
                        err,
                    );
                }
            }
        },
        [
            isCreating,
            name,
            phone,
            isPhoneValid,
            personalNumber,
            idNumber,
            releaseDate,
            comment,
            selectedOutsider,
            addOutsider,
            updateOutsider,
            handleCancelEdit,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (id: string) => {
            const outsiderName = outsiders.find((o) => o.id === id)?.name || id;
            if (
                window.confirm(
                    `האם אתה בטוח שברצונך למחוק את איש החוץ ${outsiderName}?`,
                )
            ) {
                try {
                    if (selectedOutsider && selectedOutsider.id === id) {
                        handleCancelEdit();
                    }
                    await deleteOutsider(id);
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה במחיקת איש חוץ",
                        err,
                    );
                }
            }
        },
        [
            selectedOutsider,
            handleCancelEdit,
            deleteOutsider,
            outsiders,
            enqueueSnackbar,
        ],
    );

    const showForm = isCreating || selectedOutsider !== null;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
            }}
        >
            {/* List Panel */}
            <Box
                sx={{
                    flex: 1.4,
                    minWidth: 0,
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
                    gap: 2.5,
                }}
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
                        <PersonIcon sx={{ fontSize: 20 }} />
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
                            אנשי חוץ
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            ניהול רשימת אנשי חוץ ומרצים חיצוניים במערכת
                        </Typography>
                    </Box>
                </Box>

                <TextField
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    fontSize="small"
                                    sx={{ color: "text.secondary" }}
                                />
                            </InputAdornment>
                        ),
                    }}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חפש איש חוץ..."
                    size="small"
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "10px",
                        },
                    }}
                    value={searchQuery}
                />

                <Box
                    sx={{
                        maxHeight: 340,
                        overflowY: "auto",
                        pr: 0.5,
                        pt: 2,
                        mt: -2,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.5,
                        minHeight: 180,
                    }}
                >
                    {filteredOutsiders.length === 0 ? (
                        <Box
                            sx={{
                                m: "auto",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Typography
                                sx={{
                                    color: "text.secondary",
                                    fontSize: "0.85rem",
                                    fontFamily: "Assistant, sans-serif",
                                }}
                            >
                                {searchQuery
                                    ? "לא נמצאו אנשי חוץ התואמים את החיפוש"
                                    : "לא הוגדרו אנשי חוץ"}
                            </Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {filteredOutsiders.map((outsider) => {
                                const isActive =
                                    selectedOutsider?.id === outsider.id;
                                const isReleased =
                                    outsider.releaseDate &&
                                    dayjs(outsider.releaseDate).isBefore(
                                        dayjs(),
                                        "day",
                                    );

                                return (
                                    <ListItem
                                        key={outsider.id}
                                        onClick={() =>
                                            populateFormFromOutsider(outsider)
                                        }
                                        secondaryAction={
                                            <Box
                                                alignItems="center"
                                                display="flex"
                                                gap={0.5}
                                            >
                                                <Tooltip title="ערוך">
                                                    <IconButton
                                                        edge="end"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            populateFormFromOutsider(
                                                                outsider,
                                                            );
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            color: "text.secondary",
                                                            "&:hover": {
                                                                color: "primary.main",
                                                            },
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="מחק">
                                                    <IconButton
                                                        edge="end"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleDelete(
                                                                outsider.id,
                                                            );
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            color: "text.secondary",
                                                            "&:hover": {
                                                                color: "error.main",
                                                            },
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                        sx={{
                                            border: "1px solid",
                                            borderColor: isActive
                                                ? "primary.main"
                                                : "divider",
                                            borderRadius: "12px",
                                            mb: 1.5,
                                            p: 1.5,
                                            cursor: "pointer",
                                            bgcolor: (theme) =>
                                                isActive
                                                    ? "action.selected"
                                                    : theme.palette.mode ===
                                                        "light"
                                                      ? "rgba(0,0,0,0.01)"
                                                      : "rgba(255,255,255,0.01)",
                                            transition: "all 0.2s ease",
                                            "&:hover": {
                                                borderColor: isActive
                                                    ? "primary.main"
                                                    : "text.secondary",
                                                transform: "translateY(-1px)",
                                                boxShadow:
                                                    "0 4px 12px rgba(0,0,0,0.03)",
                                            },
                                        }}
                                    >
                                        <ListItemText
                                            disableTypography
                                            primary={
                                                <Typography
                                                    component="div"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: "0.9rem",
                                                        fontFamily:
                                                            "Assistant, sans-serif",
                                                        color: "text.primary",
                                                    }}
                                                >
                                                    <Box
                                                        alignItems="center"
                                                        display="flex"
                                                        gap={1}
                                                    >
                                                        <span>
                                                            {outsider.name}
                                                        </span>
                                                        {isReleased ? (
                                                            <Tooltip title="משוחרר">
                                                                <Chip
                                                                    color="success"
                                                                    icon={
                                                                        <CheckCircleIcon
                                                                            sx={{
                                                                                fontSize:
                                                                                    "14px !important",
                                                                                color: "success.main",
                                                                            }}
                                                                        />
                                                                    }
                                                                    label="משוחרר"
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        fontSize:
                                                                            "0.65rem",
                                                                        fontWeight: 700,
                                                                        borderRadius:
                                                                            "6px",
                                                                    }}
                                                                    variant="outlined"
                                                                />
                                                            </Tooltip>
                                                        ) : null}
                                                    </Box>
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography
                                                    component="div"
                                                    sx={{
                                                        fontSize: "0.75rem",
                                                        fontFamily:
                                                            "Assistant, sans-serif",
                                                        color: "text.secondary",
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    <Box
                                                        display="flex"
                                                        flexDirection="column"
                                                        gap={0.2}
                                                    >
                                                        <span>
                                                            טלפון:{" "}
                                                            {outsider.phone}
                                                        </span>
                                                        {outsider.personalNumber ||
                                                        outsider.idNumber ? (
                                                            <span>
                                                                {outsider.personalNumber
                                                                    ? `מ.א. ${outsider.personalNumber}`
                                                                    : ""}
                                                                {outsider.personalNumber &&
                                                                outsider.idNumber
                                                                    ? " | "
                                                                    : ""}
                                                                {outsider.idNumber
                                                                    ? `ת.ז. ${outsider.idNumber}`
                                                                    : ""}
                                                            </span>
                                                        ) : null}
                                                    </Box>
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Box>

                <Button
                    color="secondary"
                    onClick={handleStartCreate}
                    startIcon={<AddIcon sx={{ ml: 0.5 }} />}
                    sx={{
                        borderRadius: "10px",
                        py: 1,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        boxShadow: "0 4px 12px rgba(26, 60, 89, 0.1)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            transform: "translateY(-1px)",
                            boxShadow: "0 6px 16px rgba(26, 60, 89, 0.2)",
                        },
                    }}
                    variant="contained"
                >
                    הוספת איש חוץ
                </Button>
            </Box>
            {/* Form Panel */}
            <Box
                component="form"
                onSubmit={handleSave}
                sx={{
                    flex: 1,
                    minWidth: 0,
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
                    opacity: showForm ? 1 : 0.5,
                    transition: "opacity 0.3s ease",
                }}
            >
                <Box alignItems="center" display="flex" gap={1.5}>
                    <Box
                        sx={{
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
                        }}
                    >
                        {isCreating ? (
                            <AddIcon sx={{ fontSize: 20 }} />
                        ) : (
                            <EditIcon sx={{ fontSize: 20 }} />
                        )}
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
                            {isCreating
                                ? "הוספת איש חוץ חדש"
                                : selectedOutsider
                                  ? "עריכת פרטי איש חוץ"
                                  : "פרטי איש חוץ"}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            {isCreating
                                ? "מלא את הטופס ליצירת איש חוץ חדש"
                                : selectedOutsider
                                  ? "עדכן את פרטי איש החוץ הנוכחי"
                                  : "בחר איש חוץ מהרשימה לעריכה"}
                        </Typography>
                    </Box>
                </Box>

                {!showForm ? (
                    <Box sx={{ m: "auto", py: 6 }}>
                        <Typography
                            sx={{
                                color: "text.secondary",
                                fontSize: "0.85rem",
                                fontFamily: "Assistant, sans-serif",
                                textAlign: "center",
                            }}
                        >
                            בחר איש חוץ מהרשימה או לחץ על הוספת איש חוץ
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Box display="flex" flexDirection="column" gap={2.5}>
                            {/* Full Name */}
                            <TextField
                                fullWidth
                                label="שם מלא"
                                onChange={(e) => setName(e.target.value)}
                                placeholder="לדוגמה: פרופ׳ ישראל ישראלי"
                                required
                                size="small"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "10px",
                                    },
                                }}
                                value={name}
                            />

                            {/* Phone */}
                            <TextField
                                error={!isPhoneValid}
                                fullWidth
                                helperText={
                                    !isPhoneValid ? "מספר טלפון לא תקין" : ""
                                }
                                label="מספר טלפון"
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="לדוגמה: 0501234567"
                                required
                                size="small"
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PhoneIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "10px",
                                    },
                                }}
                                value={phone}
                            />

                            <Divider sx={{ my: 0.5 }}>
                                <Typography
                                    sx={{
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        color: "text.secondary",
                                    }}
                                >
                                    פרטים מזהים ושחרור
                                </Typography>
                            </Divider>

                            {/* Personal Number */}
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
                                            display="flex"
                                            gap={0.5}
                                            sx={{
                                                color: "warning.main",
                                                mt: 0.2,
                                            }}
                                        >
                                            <WarningAmberIcon
                                                sx={{ fontSize: "14px" }}
                                            />
                                            <span>{personalNumberWarning}</span>
                                        </Box>
                                    ) : (
                                        ""
                                    )
                                }
                                label="מספר אישי (7 ספרות)"
                                onChange={(e) =>
                                    setPersonalNumber(
                                        e.target.value.replace(/\D/g, ""),
                                    )
                                }
                                placeholder="לדוגמה: 9876543"
                                size="small"
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <BadgeIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "10px",
                                    },
                                }}
                                value={personalNumber}
                            />

                            {/* ID Number */}
                            <TextField
                                error={
                                    !!idNumberWarning &&
                                    idNumberWarning !==
                                        "שימו לב: ת.ז. לא הוגדרה"
                                }
                                fullWidth
                                helperText={
                                    idNumberWarning ? (
                                        <Box
                                            alignItems="center"
                                            display="flex"
                                            gap={0.5}
                                            sx={{
                                                color: "warning.main",
                                                mt: 0.2,
                                            }}
                                        >
                                            <WarningAmberIcon
                                                sx={{ fontSize: "14px" }}
                                            />
                                            <span>{idNumberWarning}</span>
                                        </Box>
                                    ) : (
                                        ""
                                    )
                                }
                                label="תעודת זהות (9 ספרות)"
                                onChange={(e) =>
                                    setIdNumber(
                                        e.target.value.replace(/\D/g, ""),
                                    )
                                }
                                placeholder="לדוגמה: 123456789"
                                size="small"
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <BadgeIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "10px",
                                    },
                                }}
                                value={idNumber}
                            />

                            {/* Release Date */}
                            <Box display="flex" flexDirection="column" gap={1}>
                                <DatePicker
                                    format="DD/MM/YYYY"
                                    label="תאריך שחרור"
                                    onChange={(val) => setReleaseDate(val)}
                                    slotProps={{
                                        textField: {
                                            size: "small",
                                            sx: {
                                                "& .MuiOutlinedInput-root": {
                                                    borderRadius: "10px",
                                                },
                                            },
                                        },
                                    }}
                                    value={releaseDate}
                                />
                                {releaseDate &&
                                releaseDate.isValid() &&
                                releaseDate.isBefore(dayjs(), "day") ? (
                                    <Box
                                        alignItems="center"
                                        display="flex"
                                        gap={0.5}
                                        sx={{ color: "success.main" }}
                                    >
                                        <CheckCircleIcon
                                            sx={{ fontSize: 16 }}
                                        />
                                        <Typography
                                            sx={{ fontWeight: 700 }}
                                            variant="caption"
                                        >
                                            סטטוס: משוחרר
                                        </Typography>
                                    </Box>
                                ) : null}
                            </Box>

                            {/* Comment */}
                            <TextField
                                fullWidth
                                label="הערה"
                                multiline
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="הערות לגבי המרצה..."
                                rows={2}
                                size="small"
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment
                                                position="start"
                                                sx={{
                                                    alignSelf: "flex-start",
                                                    mt: 1,
                                                }}
                                            >
                                                <CommentIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: "text.secondary",
                                                    }}
                                                />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "10px",
                                    },
                                }}
                                value={comment}
                            />
                        </Box>

                        {/* Actions */}
                        <Box display="flex" gap={1.5} mt={1}>
                            <Button
                                color={isCreating ? "secondary" : "primary"}
                                sx={{
                                    flex: 1,
                                    borderRadius: "10px",
                                    py: 1,
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                                }}
                                type="submit"
                                variant="contained"
                            >
                                {isCreating ? "צור איש חוץ" : "עדכן איש חוץ"}
                            </Button>
                            <Button
                                color="inherit"
                                onClick={handleCancelEdit}
                                startIcon={<ClearIcon />}
                                sx={{
                                    borderRadius: "10px",
                                    py: 1,
                                    fontWeight: 700,
                                    fontSize: "0.82rem",
                                }}
                                variant="outlined"
                            >
                                ביטול
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
}
