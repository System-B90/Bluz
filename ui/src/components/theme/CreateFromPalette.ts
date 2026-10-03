import { Theme, ThemeOptions } from "@mui/material/styles";

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
