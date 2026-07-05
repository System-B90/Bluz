"use client";
import CheckIcon from "@mui/icons-material/Check";
import Box, { BoxProps } from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo, useState } from "react";

import { useCustomColors } from "@/components/base/CustomColorsProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import {
    excludeSwatchIds,
    resolveColorById,
    resolveEventDefaultColor,
    updateRecentColorIds,
} from "@/components/schedule/event-component/event-colors";
import { Event } from "@/components/schedule/types/event";

const LOCAL_STORAGE_RECENT_COLORS_KEY = "bluz-recent-colors";
const DEFAULT_COLOR_ID = "-default";

// --- ColorSwatch sub-component ---
type ColorSwatchProps = {
    hex: string;
    label: string;
    isSelected: boolean;
};

const ColorSwatch = memo(function ColorSwatch({
    hex,
    label,
    isSelected,
}: ColorSwatchProps)
{
    const theme = useTheme();
    return (
        <Tooltip title={ label }>
            <Box
                sx={ {
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: hex,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid",
                    borderColor: isSelected ? "primary.main" : "transparent",
                    transition: theme.transitions.create([ "transform" ], {
                        duration: theme.transitions.duration.shorter,
                    }),
                    color: theme.palette.getContrastText(hex),
                } }
            >
                { isSelected ? <CheckIcon sx={ { fontSize: 16 } } /> : null }
            </Box>
        </Tooltip>
    );
});

// --- Main component ---
type ColorPickerFieldProps = {
    event: Partial<Event>;
    onUpdate: (update: Partial<Event>) => void;
} & Omit<BoxProps, "onSelect">;
// `id` is the color's identity: a custom color's ID, a Hive subject's ID, or
// DEFAULT_COLOR_ID for the "no override" option.
type Swatch = { id: string; hex: string; label: string; isSelected: boolean; };

// MUI's Select reads `value` directly off its immediate MenuItem children, so
// this must render content only, not wrap MenuItem in its own component.
function SwatchOptionContent({ swatch }: { swatch: Swatch; })
{
    return (
        <>
            <ListItemIcon>
                <ColorSwatch
                    hex={ swatch.hex }
                    isSelected={ swatch.isSelected }
                    label={ swatch.label }
                />
            </ListItemIcon>
            <Typography>{ swatch.label }</Typography>
        </>
    );
}

export function ColorPickerField({
    event,
    onUpdate,
    ...boxProps
}: ColorPickerFieldProps)
{
    const theme = useTheme();
    const { getSubject, subjects } = useHiveSubjects();
    const { getCustomColor, customColors } = useCustomColors();

    const [ recentColorIds, setRecentColorIds ] = useState<Array<string>>(() =>
    {
        if (typeof window === "undefined") return [];
        try
        {
            const stored = localStorage.getItem(LOCAL_STORAGE_RECENT_COLORS_KEY);
            if (stored)
            {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed))
                {
                    return parsed.slice(0, 3);
                }
            }
        } catch (e)
        {
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
        (colorId: string) =>
        {
            if (colorId === DEFAULT_COLOR_ID)
            {
                onUpdate({ color: undefined });
                return;
            }

            onUpdate({ color: colorId });

            setRecentColorIds((prev) =>
            {
                const updated = updateRecentColorIds(prev, colorId);
                try
                {
                    localStorage.setItem(LOCAL_STORAGE_RECENT_COLORS_KEY, JSON.stringify(updated));
                } catch (e)
                {
                    console.error("Failed to save recent colors to localStorage", e);
                }
                return updated;
            });
        },
        [ onUpdate ],
    );

    // Memoize swatch entries
    const recentSwatches: Array<Swatch> = useMemo(
        () =>
            recentColorIds
                .map((id) =>
                {
                    const resolved = resolveColorById(id, { getCustomColor, getSubject });
                    if (!resolved) return undefined;
                    return {
                        id,
                        hex: resolved.hex,
                        label: resolved.label,
                        isSelected: hasOverride && event.color === id,
                    };
                })
                .filter((swatch): swatch is Swatch => !!swatch),
        [ recentColorIds, getCustomColor, getSubject, hasOverride, event.color ],
    );

    const customSwatches: Array<Swatch> = useMemo(() =>
        customColors.map((color) => ({
            id: color.id,
            hex: color.hex,
            label: color.name,
            isSelected: hasOverride && event.color === color.id,
        })),
    [ customColors, hasOverride, event.color ]);

    const subjectSwatches: Array<Swatch> = useMemo(() =>
        subjects
            .filter((s) => !!s.color)
            .map((s) => ({
                id: s.id,
                hex: s.color as string,
                label: s.displayName || s.name,
                isSelected: hasOverride && event.color === s.id,
            })),
    [ subjects, hasOverride, event.color ]);

    // A recently-used color can also be a subject or custom color that's already
    // listed in its own group below - drop those to avoid duplicate ids/keys.
    const dedupedRecentSwatches: Array<Swatch> = useMemo(() =>
        excludeSwatchIds(recentSwatches, [
            ...subjectSwatches.map((s) => s.id),
            ...customSwatches.map((s) => s.id),
        ]),
    [ recentSwatches, subjectSwatches, customSwatches ]);

    const options = useMemo(() =>
        [
            { title: "מועדפים", swatches: dedupedRecentSwatches },
            { title: "מהייב", swatches: subjectSwatches },
            { title: "מיוחדים", swatches: customSwatches },
        ]
            .filter((group) => group.swatches.length > 0)
            .flatMap((group) => [
                <ListSubheader key={ `${group.title}-header` }>
                    { group.title }
                </ListSubheader>,
                ...group.swatches.map((swatch) => (
                    <MenuItem key={ swatch.id } value={ swatch.id }>
                        <SwatchOptionContent swatch={ swatch } />
                    </MenuItem>
                )),
            ]),
    [ dedupedRecentSwatches, subjectSwatches, customSwatches ]);

    const defaultSwatch: Swatch = {
        id: DEFAULT_COLOR_ID,
        hex: defaultColor,
        label: "ברירת מחדל",
        isSelected: !hasOverride,
    };

    return (
        <FormControl
            fullWidth={ false }
            sx={ { minWidth: "5rem", ...((boxProps.sx as object) ?? {}) } }
        >
            <InputLabel>צבע</InputLabel>
            <Select
                label="צבע"
                onChange={ (e) => handleSelectColor(e.target.value) }
                value={ event.color ?? DEFAULT_COLOR_ID }
            >
                <MenuItem key={ DEFAULT_COLOR_ID } value={ DEFAULT_COLOR_ID }>
                    <SwatchOptionContent swatch={ defaultSwatch } />
                </MenuItem>
                { options }
            </Select>
        </FormControl>
    );
}
