'use client';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { SnackbarProvider } from 'notistack';

const darkTheme = createTheme({
    direction: 'rtl',
    palette: {
        mode: 'dark',
    },
});

const rtlCache = createCache({
    key: 'muirtl',
    stylisPlugins: [ rtlPlugin ],
});
export default function ThemedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <ThemeProvider theme={ darkTheme }>
            <CssBaseline />
            <CacheProvider value={ rtlCache }>
                <SnackbarProvider anchorOrigin={ { horizontal: 'right', vertical: 'bottom' } }>
                    { children }
                </SnackbarProvider>
            </CacheProvider>
        </ThemeProvider>
    );
}