"use client";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import
{
    ThemeProvider as MUIThemeProvider,
    createTheme,
} from "@mui/material/styles";
import type { ThemeProviderProps } from "next-themes";
import
{
    ThemeProvider as NextThemesProvider,
    useTheme as nextUseTheme,
} from "next-themes";
import
{
    createContext,
    useContext,
    useMemo,
    type ReactNode,
} from "react";

import { createThemeOptions } from "@/components/theme/CreateFromPalette";

// Build both color schemes once at module level — MUI CSS variables + the
// "class" selector switch the active palette without any JS re-render.
const muiTheme = createTheme({ ...createThemeOptions(), direction: "rtl" });

export type ThemeMode = "dark" | "light" | "system";

export type ThemeContextState = {
    resolvedTheme: "dark" | "light";
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextState | undefined>(undefined);

export function BluzThemeProvider({
    children,
    ...props
}: ThemeProviderProps & { children: ReactNode; })
{
    return (
        <NextThemesProvider
            { ...props }
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange={ false }
            enableSystem
        >
            <InnerThemeProvider>
                <CssBaseline />
                <GlobalStyles
                    styles={ (theme) => ({
                        "*::-webkit-scrollbar": {
                            width: "8px",
                            height: "8px",
                        },
                        "*::-webkit-scrollbar-track": {
                            background: "transparent",
                        },
                        "*::-webkit-scrollbar-thumb": {
                            backgroundColor:
                                theme.vars?.palette.action.disabledBackground ??
                                theme.palette.action.disabledBackground,
                            borderRadius: "8px",
                        },
                        "*::-webkit-scrollbar-thumb:hover": {
                            backgroundColor:
                                theme.vars?.palette.primary.main ??
                                theme.palette.primary.main,
                        },
                        "*::-webkit-scrollbar-corner": {
                            backgroundColor: "transparent",
                        },
                        "*::-webkit-scrollbar-button": {
                            display: "none",
                        },
                    }) }
                />
                { children }
            </InnerThemeProvider>
        </NextThemesProvider>
    );
}

function InnerThemeProvider({ children }: { children: ReactNode; })
{
    const { theme, setTheme, resolvedTheme } = nextUseTheme();

    const contextValue = useMemo(
        () => ({
            resolvedTheme: (resolvedTheme ?? "light") as "dark" | "light",
            theme: (theme as ThemeMode) ?? "system",
            setTheme: setTheme as (theme: ThemeMode) => void,
        }),
        [ resolvedTheme, theme, setTheme ],
    );

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
        throw new Error("useTheme must be used within a BluzThemeProvider");
    }
    return context;
};
