// app/theme-context.tsx
'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const ThemeToggleContext = createContext<() => void>(() => {});
export const useThemeToggle = () => useContext(ThemeToggleContext);

export const CustomThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setMode] = useState<'light' | 'dark'>('dark');

    const toggleTheme = () => setMode(prev => (prev === 'light' ? 'dark' : 'light'));

    const theme = useMemo(() => createTheme({
        direction: 'rtl',
        palette: { mode },
    }), [mode]);

    return (
        <ThemeToggleContext.Provider value={toggleTheme}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeToggleContext.Provider>
    );
};
