'use client';

import { BluzThemeProvider } from '@/components/theme/ThemeProvider';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { SessionProvider } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import React from 'react';

export default function ThemedLayout({ children }: { children: React.ReactNode; })
{
    return (
        <BluzThemeProvider>
            <LocalizationProvider dateAdapter={ AdapterDayjs } adapterLocale="he">
                <SnackbarProvider anchorOrigin={ { horizontal: 'right', vertical: 'bottom' } }>
                    <SessionProvider>
                        { children }
                    </SessionProvider>
                </SnackbarProvider>
            </LocalizationProvider>
        </BluzThemeProvider>
    );
}
