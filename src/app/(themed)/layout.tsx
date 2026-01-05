'use client';

import { SnackbarProvider } from 'notistack';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { prefixer } from 'stylis';
import createCache from '@emotion/cache';
import { BluezThemeProvider } from '@/components/theme/theme-provider';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from '@/components/auth/auth-provider';

const cacheRtl = createCache({
    key: 'muirtl',
    stylisPlugins: [ prefixer, rtlPlugin ],
});


export default function ThemedLayout({ children }: { children: React.ReactNode; })
{
    return (
        <AuthProvider username={ 'michaelks' }>
            <CacheProvider value={ cacheRtl }>
                <BluezThemeProvider>
                    <LocalizationProvider dateAdapter={ AdapterDayjs } adapterLocale="he">
                        <CssBaseline />
                        <SnackbarProvider anchorOrigin={ { horizontal: 'right', vertical: 'bottom' } }>
                            { children }
                        </SnackbarProvider>
                    </LocalizationProvider>
                </BluezThemeProvider>
            </CacheProvider>
        </AuthProvider>
    );
}


