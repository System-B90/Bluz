import { createTheme, Theme, ThemeOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface ColorSchemeOverrides
    {
        pink: true;
        "pink-dark": true;
    }
}

declare module "@mui/material/Chip" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface ChipPropsSizeOverrides
    {
        smaller: true;
        smallest: true;
    }
}

declare module "@mui/material/styles" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface Palette
    {
        /** The brand colour as a *text* colour — readable on the page background (#807). */
        primaryText: { main: string };
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface PaletteOptions
    {
        primaryText?: { main: string };
    }
}

/**
 * WCAG AA text colours, checked by `tests/backend/theme-contrast.test.ts`.
 *
 * - The brand turquoise `#67C8DD` is 1.93:1 on white, so it stays a *fill*; in
 *   light mode text that would have been turquoise uses a darker teal (#807).
 * - Orange `#ED6C02` is 3.11:1 against white either way round (#827).
 * - Red `#F44336` is 4.39:1 on the dark paper (#826).
 */
export const CONTRAST_COLORS = {
    lightPrimaryText: "#1B6F80",
    darkPrimaryText: "#67C8DD",
    lightWarning: "#B85300",
    darkError: "#FF6B5E",
} as const;

/** Princess Aurora pink (#765): a light scheme, so `mode` stays light. */
export const PINK_PALETTE = {
    mode: "light",
    primary: {
        main: "#E0629A", // Aurora's dress
        light: "#F49AC1",
        dark: "#B03F73",
        contrastText: "#3A0F22",
    },
    secondary: {
        main: "#8E2F62", // Deep rosewood for headings and accents
        light: "#B85D8C",
        dark: "#5E1A40",
        contrastText: "#FFFFFF",
    },
    // MUI's default info is blue; keep it in the rose family.
    info: {
        main: "#8E2F62",
        contrastText: "#FFFFFF",
    },
    background: {
        default: "#F7C6DB", // Rose page, not white-pink
        paper: "#FCE1EC",
    },
    text: {
        primary: "#3A0F22",
        secondary: "#6B2E4C",
    },
    // Without this the scheme inherits the light scheme's teal text colour.
    primaryText: { main: "#8E2F62" },
    // On a pink page the usual status colours drop below WCAG AA.
    warning: {
        main: "#8A3E00",
        contrastText: "#ffffff",
    },
    error: { main: "#A31515" },
    success: { main: "#1B5E20" },
    divider: "rgba(142, 47, 98, 0.22)",
} as const;

/** Night-time counterpart of {@link PINK_PALETTE}: deep rose surfaces, not plum. */
export const PINK_DARK_PALETTE = {
    mode: "dark",
    primary: {
        main: "#EC79A6",
        light: "#F7B3CC",
        dark: "#C04D7C",
        contrastText: "#2B0A16",
    },
    secondary: {
        main: "#F0A3BE",
        light: "#F8CCDB",
        dark: "#C2708E",
        contrastText: "#000000",
    },
    info: {
        main: "#F2A9C2",
        contrastText: "#2B0A16",
    },
    background: {
        default: "#250E15", // Deep rose, not pure black or plum
        paper: "#341921",
    },
    text: {
        primary: "#FCEBF1",
        secondary: "#D4A5B6",
    },
    primaryText: { main: "#F7A8C4" },
    error: { main: CONTRAST_COLORS.darkError },
    divider: "rgba(247, 168, 196, 0.16)",
} as const;

/** The focus ring every focusable control shows on keyboard focus (#824). */
export function focusRing(theme: Theme)
{
    return {
        outline: `2px solid ${theme.vars?.palette.primaryText.main ?? theme.palette.primaryText.main}`,
        outlineOffset: 2,
    };
}

const primaryTextColor = ({ theme }: { theme: Theme }) => ({
    color: theme.vars?.palette.primaryText.main ?? theme.palette.primaryText.main,
});

export function createThemeOptions(): ThemeOptions
{
    return {
        direction: "rtl",
        modularCssLayers: '@layer theme, base, mui, components, utilities;',
        cssVariables: {
            colorSchemeSelector: "class",
        },
        colorSchemes: {
            light: {
                palette: {
                    primary: {
                        main: "#67C8DD", // The specific Turquoise provided
                        light: "#9BF0FF",
                        dark: "#3397AB",
                        contrastText: "#002633", // Dark text for readability on bright turquoise
                    },
                    secondary: {
                        main: "#1A3C59", // "Academic" Deep Navy (School/Bis vibe)
                        light: "#466685",
                        dark: "#001730",
                        contrastText: "#ffffff",
                    },
                    background: {
                        default: "#F4FAFC", // Very subtle turquoise tint to reduce glare
                        paper: "#FFFFFF",
                    },
                    text: {
                        primary: "#0D2336", // Soft black (deep blue-gray)
                        secondary: "#587389",
                    },
                    primaryText: { main: CONTRAST_COLORS.lightPrimaryText },
                    warning: {
                        main: CONTRAST_COLORS.lightWarning,
                        contrastText: "#ffffff",
                    },
                },
            },
            dark: {
                palette: {
                    primary: {
                        main: "#67C8DD", // Keep brand color
                        light: "#9BF0FF",
                        dark: "#3397AB",
                        contrastText: "#001E29",
                    },
                    secondary: {
                        main: "#4FB0C6", // Lighter variation of secondary for dark contrast
                        light: "#83E2F9",
                        dark: "#0F8096",
                        contrastText: "#000000",
                    },
                    background: {
                        default: "#071624", // Deep Midnight Blue (not pure black)
                        paper: "#0C2237", // Slightly lighter midnight for cards
                    },
                    text: {
                        primary: "#EBF7FA", // Off-white with slight cyan tint
                        secondary: "#8DA6B5",
                    },
                    primaryText: { main: CONTRAST_COLORS.darkPrimaryText },
                    error: { main: CONTRAST_COLORS.darkError },
                },
            },
            // MUI only expands light/dark from partial input; a custom
            // scheme must arrive as a complete palette.
            pink: { palette: createTheme({ palette: PINK_PALETTE }).palette },
            "pink-dark": { palette: createTheme({ palette: PINK_DARK_PALETTE }).palette },
        },
        typography: {
            fontFamily: [ '"Assistant"', "sans-serif" ].join(","),
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            h3: { fontWeight: 600 },
            button: { fontWeight: 600 },
        },
        components: {
            MuiButtonBase: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        "&.Mui-focusVisible": focusRing(theme),
                    }),
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        "&.Mui-selected": primaryTextColor({ theme }),
                    }),
                },
            },
            MuiTypography: {
                variants: [ { props: { color: "primary" }, style: primaryTextColor } ],
            },
            MuiLink: {
                variants: [ { props: { color: "primary" }, style: primaryTextColor } ],
            },
            MuiSvgIcon: {
                variants: [ { props: { color: "primary" }, style: primaryTextColor } ],
            },
            MuiIconButton: {
                variants: [ { props: { color: "primary" }, style: primaryTextColor } ],
            },
            MuiChip: {
                variants: [
                    { props: { variant: "outlined", color: "primary" }, style: primaryTextColor },
                    {
                        props: { size: "smaller" },
                        style: {
                            height: 16,
                            fontSize: 12,
                            padding: "0 2px",
                            borderRadius: 12,
                            // TARGET THE INTERNAL LABEL HERE
                            "& .MuiChip-label": {
                                paddingLeft: 4, // Reduced from default 12px
                                paddingRight: 4, // Reduced from default 12px
                            },
                            "& .MuiChip-icon": {
                                fontSize: 10,
                                marginLeft: 2, // Optional: fine-tune icon spacing
                                marginRight: -2,
                            },
                        },
                    },
                    {
                        props: { size: "smallest" },
                        style: {
                            height: 12,
                            fontSize: 8,
                            padding: "0 1px",
                            borderRadius: 12,
                            // TARGET THE INTERNAL LABEL HERE
                            "& .MuiChip-label": {
                                paddingLeft: 1,
                                paddingRight: 1,
                            },
                            "& .MuiChip-icon": { fontSize: 8 },
                        },
                    },
                ],
            },
            MuiButton: {
                variants: [
                    { props: { variant: "text", color: "primary" }, style: primaryTextColor },
                    { props: { variant: "outlined", color: "primary" }, style: primaryTextColor },
                ],
                styleOverrides: {
                    root: {
                        textTransform: "none", // Modern look
                        fontWeight: 600,
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    rounded: {
                        borderRadius: 12, // Softer edges for calendar items
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: ({ theme }) => ({
                        borderRadius: "20px",
                        overflow: "hidden",
                        backgroundColor: theme.vars.palette.background.paper,
                        backgroundImage: "none",
                        boxShadow: "0 24px 50px rgba(0,0,0,0.15)",
                        border: "1px solid",
                        borderColor: theme.vars.palette.divider,
                    }),
                },
            },
            MuiButtonGroup: {
                styleOverrides: {
                    root: {
                        boxShadow: "none !important",
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        backgroundColor: theme.vars.palette.background.paper,
                        backgroundImage: "none",
                        boxShadow: "none",
                        borderBottom: "1px solid",
                        borderColor: theme.vars.palette.divider,
                        color: theme.vars.palette.text.primary,
                    }),
                },
            },
        },
    };
}
