'use client';

import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';


export default function ThemedLayout({ children }: { children: React.ReactNode; })
{
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <LocalizationProvider dateAdapter={ AdapterDayjs } adapterLocale="he">

                {/*<CssBaseline />*/ }
                <SnackbarProvider anchorOrigin={ { horizontal: 'right', vertical: 'bottom' } }>
                    { children }
                </SnackbarProvider>
            </LocalizationProvider>
        </ThemeProvider>
    );
}


