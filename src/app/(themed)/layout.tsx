import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import rtlPlugin from 'stylis-plugin-rtl';
import { SnackbarProvider } from 'notistack';
import { CustomThemeProvider } from '@/components/theme/theme-context';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeSelect } from '@/components/theme/theme-select';
import CssBaseline from '@mui/material/CssBaseline';

const rtlCache = createCache({
    key: 'muirtl',
    stylisPlugins: [rtlPlugin],
});

export default function ThemedLayout({ children }: { children: React.ReactNode }) {
    return (
        // <CustomThemeProvider>
        //     <CacheProvider value={rtlCache}>
        //         <SnackbarProvider anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
        //             {children}
        //         </SnackbarProvider>
        //     </CacheProvider>
        // </CustomThemeProvider>

    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
        {/*<CssBaseline />*/}
        {children}
    </ThemeProvider>
    );
}


