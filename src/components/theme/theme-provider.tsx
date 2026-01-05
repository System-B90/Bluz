"use client";

import { createTheme, ThemeProvider as MUIThemeProvider } from "@mui/material";
import { ThemeProvider as NextThemesProvider, useTheme as nextUseTheme, type ThemeProviderProps } from "next-themes";
import { createContext, useContext, useMemo, useState, ReactNode, Dispatch, SetStateAction, useEffect } from "react";

// Extend MUI chip sizes
declare module '@mui/material/Chip' {
    interface ChipPropsSizeOverrides
    {
        smaller: true;
        smallest: true;
    }
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeContextState = {
    theme: ThemeMode;
    setTheme: Dispatch<SetStateAction<ThemeMode>>;
};

const ThemeContext = createContext<ThemeContextState | undefined>(undefined);

export function BluezThemeProvider({ children, ...props }: ThemeProviderProps & { children: ReactNode; })
{
    return (
        <NextThemesProvider
            { ...props }
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <InnerThemeProvider>
                { children }
            </InnerThemeProvider>
        </NextThemesProvider>
    );
}

// Inner component no longer needs props passed to it
function InnerThemeProvider({ children }: { children: ReactNode; })
{
    const { theme, setTheme, resolvedTheme } = nextUseTheme();
    const [ mounted, setMounted ] = useState(false);

    useEffect(() =>
    {
        setMounted(true);
    }, [ setMounted ]);

    // 2. Calculate MUI mode
    // - If server/hydrating (not mounted): Force 'light' to match server HTML.
    // - If mounted: Use 'resolvedTheme' (which converts 'system' -> 'dark'/'light').
    const paletteMode = mounted ? (resolvedTheme as 'light' | 'dark') : 'light';

    const muiTheme = useMemo(
        () =>
            createTheme({
                palette: {
                    // Ensure strict casting (resolvedTheme can be undefined briefly)
                    mode: paletteMode || 'light',
                },
                components: {
                    MuiChip: {
                        variants: [
                            {
                                props: { size: 'smaller' },
                                style: {
                                    height: 16,
                                    fontSize: 10,
                                    padding: '0 8px',
                                    borderRadius: 12,
                                    '& .MuiChip-icon': { fontSize: 10 },
                                },
                            },
                            {
                                props: { size: 'smallest' },
                                style: {
                                    height: 12,
                                    fontSize: 8,
                                    padding: '0 4px',
                                    borderRadius: 12,
                                    '& .MuiChip-icon': { fontSize: 8 },
                                },
                            },
                        ],
                    },
                },
            }),
        [ paletteMode ]
    );

    // 3. Memoize the context value
    // We map next-themes values to your context shape.
    const contextValue = useMemo(() => ({
        theme: (theme as ThemeMode) || 'system',
        setTheme: setTheme as Dispatch<SetStateAction<ThemeMode>>
    }), [ theme, setTheme ]);

    return (
        <ThemeContext.Provider value={ contextValue }>
            <MUIThemeProvider theme={ muiTheme }>{ children }</MUIThemeProvider>
        </ThemeContext.Provider>
    );
}

export const useTheme = () =>
{
    const context = useContext(ThemeContext);
    if (!context)
    {
        throw new Error('useTheme must be used within a BluezThemeProvider');
    }
    return context;
};