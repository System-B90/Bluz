'use client';

import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { SnackbarProvider } from 'notistack';
import { CustomThemeProvider } from '@/components/theme/theme-context';

const rtlCache = createCache({
    key: 'muirtl',
    stylisPlugins: [rtlPlugin],
});

export default function ThemedLayout({ children }: { children: React.ReactNode }) {
    return (
        <CustomThemeProvider>
            <CacheProvider value={rtlCache}>
                <SnackbarProvider anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
                    {children}
                </SnackbarProvider>
            </CacheProvider>
        </CustomThemeProvider>
    );
}
