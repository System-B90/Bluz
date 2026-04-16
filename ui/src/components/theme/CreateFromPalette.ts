import { ThemeOptions } from "@mui/material/styles";

declare module '@mui/material/Chip' {
    interface ChipPropsSizeOverrides
    {
        smaller: true;
        smallest: true;
    }
}

export function createFromPalette(paletteMode: 'light' | 'dark'): ThemeOptions
{
    return {
        typography: {
            fontFamily: [ '"Assistant"', 'sans-serif' ].join(','),
            h1: { fontWeight: 700 },
            h2: { fontWeight: 700 },
            h3: { fontWeight: 600 },
            button: { fontWeight: 600 },
        },
        palette: {
            mode: paletteMode ?? 'light',
            ...(paletteMode === 'light'
                ? {
                    // LIGHT MODE
                    primary: {
                        main: '#67C8DD', // The specific Turquoise provided
                        light: '#9BF0FF',
                        dark: '#3397AB',
                        contrastText: '#002633', // Dark text for readability on bright turquoise
                    },
                    secondary: {
                        main: '#1A3C59', // "Academic" Deep Navy (School/Bis vibe)
                        light: '#466685',
                        dark: '#001730',
                        contrastText: '#ffffff',
                    },
                    background: {
                        default: '#F4FAFC', // Very subtle turquoise tint to reduce glare
                        paper: '#FFFFFF',
                    },
                    text: {
                        primary: '#0D2336', // Soft black (deep blue-gray)
                        secondary: '#587389',
                    },
                }
                : {
                    // DARK MODE
                    primary: {
                        main: '#67C8DD', // Keep brand color
                        light: '#9BF0FF',
                        dark: '#3397AB',
                        contrastText: '#001E29',
                    },
                    secondary: {
                        main: '#4FB0C6', // Lighter variation of secondary for dark contrast
                        light: '#83E2F9',
                        dark: '#0F8096',
                        contrastText: '#000000',
                    },
                    background: {
                        default: '#071624', // Deep Midnight Blue (not pure black)
                        paper: '#0C2237', // Slightly lighter midnight for cards
                    },
                    text: {
                        primary: '#EBF7FA', // Off-white with slight cyan tint
                        secondary: '#8DA6B5',
                    },
                }),
        },
        components: {
            MuiChip: {
                variants: [
                    {
                        props: { size: 'smaller' },
                        style: {
                            height: 16,
                            fontSize: 12,
                            padding: '0 2px',
                            borderRadius: 12,
                            // TARGET THE INTERNAL LABEL HERE
                            '& .MuiChip-label': {
                                paddingLeft: 4,  // Reduced from default 12px
                                paddingRight: 4, // Reduced from default 12px
                            },
                            '& .MuiChip-icon': {
                                fontSize: 10,
                                marginLeft: 2, // Optional: fine-tune icon spacing
                                marginRight: -2
                            },
                        },
                    },
                    {
                        props: { size: 'smallest' },
                        style: {
                            height: 12,
                            fontSize: 8,
                            padding: '0 1px',
                            borderRadius: 12,
                            // TARGET THE INTERNAL LABEL HERE
                            '& .MuiChip-label': {
                                paddingLeft: 1,
                                paddingRight: 1,
                            },
                            '& .MuiChip-icon': { fontSize: 8 },
                        },
                    },
                ],
            },
            // Optional: Round corners slightly to match the "Fluid/Musical" feel of the icon
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none', // Modern look
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
            MuiAppBar: {
                styleOverrides: {
                    colorDefault: {
                        backgroundColor: paletteMode === 'light' ? 'rgba(173,226,238,0.29)' : undefined,
                    }
                }
            }
        },
    };
}
