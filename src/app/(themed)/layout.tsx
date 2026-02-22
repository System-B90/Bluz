'use client';

import React, { useState } from 'react';
import { SnackbarProvider } from 'notistack';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { CacheProvider } from '@emotion/react';
import rtlPlugin from '@mui/stylis-plugin-rtl';
import { prefixer } from 'stylis';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { BluezThemeProvider } from '@/components/theme/theme-provider';
import { CssBaseline } from '@mui/material';
import { AuthProvider } from '@/components/auth/auth-provider';

export default function ThemedLayout({ children }: { children: React.ReactNode; })
{
    // 1. Create the cache inside the component using useState so it is safely scoped per-request
    const [ { cache, flush } ] = useState(() =>
    {
        const cache = createCache({
            key: 'muirtl',
            stylisPlugins: [ prefixer, rtlPlugin ],
        });
        cache.compat = true;
        const prevInsert = cache.insert;
        let inserted: string[] = [];
        cache.insert = (...args) =>
        {
            const serialized = args[ 1 ];
            if (cache.inserted[ serialized.name ] === undefined)
            {
                inserted.push(serialized.name);
            }
            return prevInsert(...args);
        };
        const flush = () =>
        {
            const prevInserted = inserted;
            inserted = [];
            return prevInserted;
        };
        return { cache, flush };
    });

    // 2. Inject the extracted styles into the <head> during SSR
    useServerInsertedHTML(() =>
    {
        const names = flush();
        if (names.length === 0)
        {
            return null;
        }
        let styles = '';
        for (const name of names)
        {
            styles += cache.inserted[ name ];
        }
        return (
            <style
                key={ cache.key }
                data-emotion={ `${cache.key} ${names.join(' ')}` }
                dangerouslySetInnerHTML={ { __html: styles } }
            />
        );
    });

    return (
        <AuthProvider username={ 'michaelks' }>
            <CacheProvider value={ cache }>
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