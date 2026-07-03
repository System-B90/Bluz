"use client";
import CheckIcon from "@mui/icons-material/Check";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { useCallback, useState } from "react";

import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { Event, EventType } from "@/components/schedule/types/event";

type ColorPickerFieldProps = {
    event: Partial<Event>;
    onUpdate: (update: Partial<Event>) => void;
};

const LOCAL_STORAGE_RECENT_COLORS_KEY = "bluz-recent-colors";

export function ColorPickerField({ event, onUpdate }: ColorPickerFieldProps) {
    const theme = useTheme();
    const { getSubject } = useHiveSubjects();
    const { customColors } = useCustomColors();

    const [recentColors, setRecentColors] = useState<Array<string>>(() => {
        if (typeof window === "undefined") return [];
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_RECENT_COLORS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed.slice(0, 3);
                }
            }
        } catch (e) {
            console.error("Failed to load recent colors from localStorage", e);
        }
        return [];
    });

    // Resolve default Hive color
    const subject = event.subject ? getSubject(event.subject) : undefined;
    const defaultColor =
        (event.type === EventType.PRAYER ? "#e0f9fe" : subject?.color) ??
        theme.palette.common.black;

    const hasOverride = !!event.color;

    const handleSelectColor = useCallback(
        (hex: string) => {
            onUpdate({ color: hex });

            // Update recent colors
            setRecentColors((prev) => {
                const filtered = prev.filter((c) => c.toLowerCase() !== hex.toLowerCase());
                const updated = [hex, ...filtered].slice(0, 3);
                try {
                    localStorage.setItem(LOCAL_STORAGE_RECENT_COLORS_KEY, JSON.stringify(updated));
                } catch (e) {
                    console.error("Failed to save recent colors to localStorage", e);
                }
                return updated;
            });
        },
        [onUpdate],
    );

    const handleRevert = useCallback(() => {
        onUpdate({ color: undefined });
    }, [onUpdate]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "text.primary" }}>
                צבע מופע
            </Typography>

            {/* Picker Sections */}
            <Box display="flex" flexDirection="column" gap={2} sx={{ pl: 1 }}>
                {/* Default Color Row */}
                <Box alignItems="center" display="flex" gap={2}>
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", minWidth: 90 }}>
                        ברירת מחדל:
                    </Typography>
                    <Tooltip title="צבע ברירת מחדל (Hive)">
                        <Box
                            onClick={handleRevert}
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                bgcolor: defaultColor,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                border: "2px solid",
                                borderColor: !hasOverride ? "primary.main" : "transparent",
                                transition: "all 0.2s ease",
                                color: theme.palette.getContrastText(defaultColor),
                                "&:hover": {
                                    transform: "scale(1.1)",
                                },
                            }}
                        >
                            {!hasOverride && <CheckIcon sx={{ fontSize: 16 }} />}
                        </Box>
                    </Tooltip>
                    {hasOverride ? <Button
                        onClick={handleRevert}
                        size="small"
                        startIcon={<RotateLeftIcon />}
                        sx={{ borderRadius: "8px", py: 0.25 }}
                        variant="outlined"
                    >
                            חזרה לברירת מחדל
                    </Button> : null}
                </Box>

                {/* Recent Colors Row */}
                {recentColors.length > 0 && (
                    <Box alignItems="center" display="flex" gap={2}>
                        <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", minWidth: 90 }}>
                            בשימוש לאחרונה:
                        </Typography>
                        <Box display="flex" gap={1}>
                            {recentColors.map((color) => {
                                const isSelected = hasOverride && event.color?.toLowerCase() === color.toLowerCase();
                                return (
                                    <Tooltip key={color} title={color}>
                                        <Box
                                            onClick={() => handleSelectColor(color)}
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: "50%",
                                                bgcolor: color,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                cursor: "pointer",
                                                border: "2px solid",
                                                borderColor: isSelected ? "primary.main" : "transparent",
                                                transition: "all 0.2s ease",
                                                color: theme.palette.getContrastText(color),
                                                "&:hover": {
                                                    transform: "scale(1.1)",
                                                },
                                            }}
                                        >
                                            {isSelected ? <CheckIcon sx={{ fontSize: 16 }} /> : null}
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    </Box>
                )}

                {/* Custom Colors Row */}
                <Box alignItems="flex-start" display="flex" gap={2}>
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", minWidth: 90, pt: 0.5 }}>
                        צבעים מותאמים:
                    </Typography>
                    {customColors.length === 0 ? (
                        <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", pt: 0.5 }}>
                            אין צבעים מותאמים אישית (ניתן להוסיף בהגדרות)
                        </Typography>
                    ) : (
                        <Box display="flex" flexWrap="wrap" gap={1} maxWidth="400px">
                            {customColors.map((color) => {
                                const isSelected = hasOverride && event.color?.toLowerCase() === color.hex.toLowerCase();
                                return (
                                    <Tooltip key={color.id} title={color.name}>
                                        <Box
                                            onClick={() => handleSelectColor(color.hex)}
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: "50%",
                                                bgcolor: color.hex,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                cursor: "pointer",
                                                border: "2px solid",
                                                borderColor: isSelected ? "primary.main" : "transparent",
                                                transition: "all 0.2s ease",
                                                color: theme.palette.getContrastText(color.hex),
                                                "&:hover": {
                                                    transform: "scale(1.1)",
                                                },
                                            }}
                                        >
                                            {isSelected ? <CheckIcon sx={{ fontSize: 16 }} /> : null}
                                        </Box>
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
