'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import rtlPlugin from 'stylis-plugin-rtl';
import { prefixer } from 'stylis';

export function MuiEmotionCacheProvider({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <AppRouterCacheProvider
            options={ {
                key: 'muirtl',
                stylisPlugins: [ prefixer, rtlPlugin ],
            } }
        >
            { children }
        </AppRouterCacheProvider>
    );
}
