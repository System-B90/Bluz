"use client";
import CheckIcon from "@mui/icons-material/Check";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import Box, { BoxProps } from "@mui/material/Box";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, { memo, useCallback, useMemo, useState } from "react";

import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { resolveEventDefaultColor } from "@/components/schedule/event-component/event-colors";
import { Event } from "@/components/schedule/types/event";

const LOCAL_STORAGE_RECENT_COLORS_KEY = "bluz-recent-colors";

// --- ColorSwatch sub-component ---
type ColorSwatchProps = {
    hex: string;
    label: string;
    isSelected: boolean;
    onSelect: (hex: string) => void;
};

const ColorSwatch = memo(function ColorSwatch({
    hex,
    label,
    isSelected,
    onSelect,
}: ColorSwatchProps) {
    const theme = useTheme();
    return (
        <Tooltip title={label}>
            <Box
                onClick={() => onSelect(hex)}
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: hex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: isSelected ? "primary.main" : "transparent",
                    transition: "all 0.2s ease",
                    color: theme.palette.getContrastText(hex),
                    "&:hover": {
                        transform: "scale(1.1)",
                    },
                }}
            >
                {isSelected ? <CheckIcon sx={{ fontSize: 16 }} /> : null}
            </Box>
        </Tooltip>
    );
});

// --- Main component ---
type ColorPickerFieldProps = {
    event: Partial<Event>;
    onUpdate: (update: Partial<Event>) => void;
} & Omit<BoxProps, "onSelect">;

export function ColorPickerField({
    event,
    onUpdate,
    ...boxProps
}: ColorPickerFieldProps) {
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

    // Resolve default Hive color using the shared helper
    const subject = event.subject ? getSubject(event.subject) : undefined;
    const defaultColor = resolveEventDefaultColor(
        event,
        subject,
        theme.palette.common.black,
    );

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

    // Memoize swatch entries
    const recentSwatches = useMemo(
        () =>
            recentColors.map((color) => ({
                hex: color,
                label: color,
                isSelected:
                    hasOverride &&
                    event.color?.toLowerCase() === color.toLowerCase(),
            })),
        [recentColors, hasOverride, event.color],
    );

    const customSwatches = useMemo(
        () =>
            customColors.map((color) => ({
                hex: color.hex,
                label: color.name,
                isSelected:
                    hasOverride &&
                    event.color?.toLowerCase() === color.hex.toLowerCase(),
            })),
        [customColors, hasOverride, event.color],
    );

    return (
        <Box
            {...boxProps}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                mt: 1,
                ...((boxProps.sx as object) ?? {}),
            }}
        >
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
                    <ColorSwatch
                        hex={defaultColor}
                        isSelected={!hasOverride}
                        label="צבע ברירת מחדל (Hive)"
                        onSelect={handleRevert}
                    />
                    {hasOverride ? (
                        <Button
                            onClick={handleRevert}
                            size="small"
                            startIcon={<RotateLeftIcon />}
                            sx={{ borderRadius: "8px", py: 0.25 }}
                            variant="outlined"
                        >
                            חזרה לברירת מחדל
                        </Button>
                    ) : null}
                </Box>

                {/* Recent Colors Row */}
                {recentSwatches.length > 0 && (
                    <Box alignItems="center" display="flex" gap={2}>
                        <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", minWidth: 90 }}>
                            בשימוש לאחרונה:
                        </Typography>
                        <Box display="flex" gap={1}>
                            {recentSwatches.map((swatch) => (
                                <ColorSwatch
                                    hex={swatch.hex}
                                    isSelected={swatch.isSelected}
                                    key={swatch.hex}
                                    label={swatch.label}
                                    onSelect={handleSelectColor}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Custom Colors Row */}
                <Box alignItems="flex-start" display="flex" gap={2}>
                    <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", minWidth: 90, pt: 0.5 }}>
                        צבעים מותאמים:
                    </Typography>
                    {customSwatches.length === 0 ? (
                        <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", pt: 0.5 }}>
                            אין צבעים מותאמים אישית (ניתן להוסיף בהגדרות)
                        </Typography>
                    ) : (
                        <Box display="flex" flexWrap="wrap" gap={1} maxWidth="400px">
                            {customSwatches.map((swatch) => (
                                <ColorSwatch
                                    hex={swatch.hex}
                                    isSelected={swatch.isSelected}
                                    key={swatch.hex}
                                    label={swatch.label}
                                    onSelect={handleSelectColor}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
