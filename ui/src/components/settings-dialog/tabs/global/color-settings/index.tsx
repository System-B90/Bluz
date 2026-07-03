"use client";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PaletteIcon from "@mui/icons-material/Palette";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import React, { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CustomColor } from "@/api-shared/types/custom-color";
import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";

export function ColorSettings() {
    const { customColors, addCustomColor, updateCustomColor, deleteCustomColor } =
        useCustomColors();
    const { subjects } = useHiveSubjects();
    const { enqueueSnackbar } = useSnackbar();

    const [selectedColor, setSelectedColor] = useState<CustomColor | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState("");
    const [hex, setHex] = useState("#3f51b5");

    // Map Hive subjects into read-only colors
    const subjectColors = useMemo(() => {
        return subjects
            .filter((s) => s.color)
            .map((s) => ({
                id: `subject-${s.id}`,
                name: s.displayName || s.name,
                hex: s.color as string,
                isReadonly: true,
            }));
    }, [subjects]);

    // Merge custom colors and subject colors
    const allColors = useMemo(() => {
        const customMapped = customColors.map((c) => ({
            ...c,
            isReadonly: false,
        }));
        return [...customMapped, ...subjectColors];
    }, [customColors, subjectColors]);

    const handleSelectColor = useCallback((color: CustomColor) => {
        setSelectedColor(color);
        setIsCreating(false);
        setName(color.name);
        setHex(color.hex);
    }, []);

    const handleStartCreate = useCallback(() => {
        setSelectedColor(null);
        setIsCreating(true);
        setName("");
        setHex("#3f51b5");
    }, []);

    const handleCancelEdit = useCallback(() => {
        setSelectedColor(null);
        setIsCreating(false);
        setName("");
        setHex("#3f51b5");
    }, []);

    const handleSave = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmedName = name.trim();
            const trimmedHex = hex.trim();

            if (!trimmedName) {
                enqueueSnackbar("שם הצבע הוא שדה חובה", { variant: "warning" });
                return;
            }

            if (!trimmedHex.startsWith("#") || trimmedHex.length !== 7) {
                enqueueSnackbar("קוד צבע חייב להיות בפורמט Hex תקין (למשל, #ffffff)", {
                    variant: "warning",
                });
                return;
            }

            if (isCreating) {
                try {
                    await addCustomColor({
                        name: trimmedName,
                        hex: trimmedHex,
                    });
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה ביצירת צבע מותאם אישית",
                        err,
                    );
                }
            } else if (selectedColor) {
                try {
                    await updateCustomColor({
                        ...selectedColor,
                        name: trimmedName,
                        hex: trimmedHex,
                    });
                    handleCancelEdit();
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה בעדכון צבע מותאם אישית",
                        err,
                    );
                }
            }
        },
        [
            isCreating,
            name,
            hex,
            selectedColor,
            addCustomColor,
            updateCustomColor,
            handleCancelEdit,
            enqueueSnackbar,
        ],
    );

    const handleDelete = useCallback(
        async (colorId: string) => {
            const colorName =
                customColors.find((c) => c.id === colorId)?.name || colorId;
            if (
                window.confirm(
                    `האם אתה בטוח שברצונך למחוק את הצבע המותאם אישית "${colorName}"?`,
                )
            ) {
                try {
                    if (selectedColor && selectedColor.id === colorId) {
                        handleCancelEdit();
                    }
                    await deleteCustomColor(colorId);
                } catch (err) {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "שגיאה במחיקת צבע מותאם אישית",
                        err,
                    );
                }
            }
        },
        [selectedColor, handleCancelEdit, deleteCustomColor, customColors, enqueueSnackbar],
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", lg: "row" },
                gap: 3,
                alignItems: "stretch",
                justifyContent: "center",
                width: "100%",
                height: "100%",
            }}
        >
            {/* Colors List Card */}
            <Card
                sx={{
                    flex: 1.2,
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "16px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                    border: "1px solid",
                    borderColor: "divider",
                }}
            >
                <CardContent
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        p: 3,
                        "&:last-child": { pb: 3 },
                    }}
                >
                    <Box
                        alignItems="center"
                        display="flex"
                        justifyContent="space-between"
                        mb={2}
                    >
                        <Box alignItems="center" display="flex" gap={1.5}>
                            <PaletteIcon color="primary" />
                            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
                                ניהול צבעי מערכת
                            </Typography>
                        </Box>
                        <Button
                            color="primary"
                            onClick={handleStartCreate}
                            size="small"
                            variant="contained"
                        >
                            הוספת צבע חדש
                        </Button>
                    </Box>

                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", mb: 2 }}>
                        כל הצבעים הזמינים במערכת. צבעי מקצועות נטענים מ-Hive והם לקריאה בלבד.
                    </Typography>

                    <Divider />

                    <Box sx={{ overflowY: "auto", flexGrow: 1, maxHeight: "350px", mt: 1 }}>
                        {allColors.length === 0 ? (
                            <Typography
                                sx={{
                                    textAlign: "center",
                                    color: "text.secondary",
                                    mt: 4,
                                    fontSize: "0.9rem",
                                }}
                            >
                                אין צבעים מוגדרים במערכת
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {allColors.map((color) => (
                                    <ListItem
                                        button={!color.isReadonly}
                                        key={color.id}
                                        onClick={() =>
                                            !color.isReadonly
                                                ? handleSelectColor(color as CustomColor)
                                                : undefined
                                        }
                                        sx={{
                                            borderRadius: "8px",
                                            mb: 0.5,
                                            bgcolor:
                                                selectedColor?.id === color.id
                                                    ? "action.selected"
                                                    : "transparent",
                                            "&:hover": {
                                                bgcolor: color.isReadonly
                                                    ? "transparent"
                                                    : "action.hover",
                                            },
                                        }}
                                    >
                                        {/* Color Preview Block */}
                                        <Box
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                borderRadius: "4px",
                                                bgcolor: color.hex,
                                                mr: 2,
                                                border: "1px solid",
                                                borderColor: "divider",
                                            }}
                                        />
                                        <ListItemText
                                            primary={color.name}
                                            secondary={color.hex}
                                            sx={{ textAlign: "right", pr: 2 }}
                                        />
                                        <ListItemSecondaryAction>
                                            {color.isReadonly ? (
                                                <Chip
                                                    label="מקצוע Hive"
                                                    size="small"
                                                    sx={{ fontSize: "0.7rem", height: 20 }}
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Box display="flex" gap={0.5}>
                                                    <IconButton
                                                        edge="end"
                                                        onClick={() =>
                                                            handleSelectColor(color as CustomColor)
                                                        }
                                                        size="small"
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        color="error"
                                                        edge="end"
                                                        onClick={() => handleDelete(color.id)}
                                                        size="small"
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Edit / Create Form Card */}
            <Card
                sx={{
                    flex: 0.8,
                    borderRadius: "16px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                    border: "1px solid",
                    borderColor: "divider",
                }}
            >
                <CardContent sx={{ p: 3 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", mb: 3 }}>
                        {isCreating
                            ? "הוספת צבע מותאם אישית"
                            : selectedColor
                                ? `עריכת צבע: ${selectedColor.name}`
                                : "פרטי צבע"}
                    </Typography>

                    {!isCreating && !selectedColor ? (
                        <Box
                            alignItems="center"
                            display="flex"
                            flexDirection="column"
                            justifyContent="center"
                            minHeight="200px"
                            sx={{ color: "text.secondary", gap: 1 }}
                        >
                            <PaletteIcon sx={{ fontSize: 40, opacity: 0.5 }} />
                            <Typography sx={{ fontSize: "0.85rem" }}>
                                בחר צבע מהרשימה לעריכה או צור צבע חדש
                            </Typography>
                        </Box>
                    ) : (
                        <form onSubmit={handleSave}>
                            <Box display="flex" flexDirection="column" gap={3}>
                                <TextField
                                    fullWidth
                                    label="שם הצבע"
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    size="small"
                                    value={name}
                                />

                                <Box alignItems="center" display="flex" gap={2}>
                                    <TextField
                                        fullWidth
                                        label="קוד צבע (Hex)"
                                        onChange={(e) => setHex(e.target.value)}
                                        required
                                        size="small"
                                        value={hex}
                                    />
                                    <input
                                        onChange={(e) => setHex(e.target.value)}
                                        style={{
                                            width: 48,
                                            height: 40,
                                            border: "1px solid #ccc",
                                            borderRadius: "8px",
                                            cursor: "pointer",
                                            padding: 0,
                                            backgroundColor: "transparent",
                                        }}
                                        type="color"
                                        value={
                                            hex.startsWith("#") && hex.length === 7
                                                ? hex
                                                : "#3f51b5"
                                        }
                                    />
                                </Box>

                                <Box display="flex" gap={1.5} justifyContent="flex-end" mt={1}>
                                    <Button onClick={handleCancelEdit} size="small">
                                        ביטול
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="small"
                                        type="submit"
                                        variant="contained"
                                    >
                                        שמירה
                                    </Button>
                                </Box>
                            </Box>
                        </form>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
