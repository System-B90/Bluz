"use client";

import { createTheme, ThemeProvider } from "@mui/material";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes";

const theme = createTheme({
    components: {
        MuiChip: {
            variants: [
                {
                    props: { size: 'smaller' },
                    style: {
                        height: '16px',
                        fontSize: '10px',
                        padding: '0 8px',
                        borderRadius: 12,
                        '& .MuiChip-icon': {
                            fontSize: '10px',
                        },
                    },
                },
                {
                    props: { size: 'smallest' },
                    style: {
                        height: '12px',
                        fontSize: '8px',
                        padding: '0 4px',
                        borderRadius: 12,
                        '& .MuiChip-icon': {
                            fontSize: '8px',
                        },
                    },
                },
            ],
        },
    },
});

export function BluezThemeProvider({ children, ...props }: ThemeProviderProps)
{
    return (
        <ThemeProvider theme={ theme }>
            <NextThemesProvider { ...props }>
                { children }
            </NextThemesProvider>
        </ThemeProvider>
    );
}
