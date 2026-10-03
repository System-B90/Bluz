import { createTheme, ThemeOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface ColorSchemeOverrides
    {
        pink: true;
    }
}

/** Soft "princess" pink (#765): a light scheme, so `mode` stays light. */
export const PINK_PALETTE = {
    mode: "light",
    primary: {
        main: "#E48AB0", // Aurora rose
        light: "#F6C4D9",
        dark: "#B8607F",
        contrastText: "#3A0F22",
    },
    secondary: {
        main: "#9C4F79", // Deep rosewood for headings and accents
        light: "#C47FA4",
        dark: "#6E2E52",
        contrastText: "#FFFFFF",
    },
    background: {
        default: "#FFF3F8", // Blush, not neon
        paper: "#FFFBFD",
    },
    text: {
        primary: "#3D1A2C",
        secondary: "#7E5168",
    },
    divider: "rgba(184, 96, 127, 0.2)",
} as const;

declare module "@mui/material/Chip" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- MUI module augmentation requires interface for declaration merging
    interface ChipPropsSizeOverrides
    {
        smaller: true;
        smallest: true;
    }
}

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
                },
            },
            // MUI only expands light/dark from partial input; a custom
            // scheme must arrive as a complete palette.
            pink: { palette: createTheme({ palette: PINK_PALETTE }).palette },
        },
        typography: {
            fontFamily: [ '"Assistant"', "sans-serif" ].join(","),
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            h3: { fontWeight: 600 },
            button: { fontWeight: 600 },
        },
        components: {
            MuiChip: {
                variants: [
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
