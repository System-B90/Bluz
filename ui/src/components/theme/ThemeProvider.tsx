"use client";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import {
    ThemeProvider as MUIThemeProvider,
    createTheme,
} from "@mui/material/styles";
import type { ThemeProviderProps } from "next-themes";
import {
    ThemeProvider as NextThemesProvider,
    useTheme as nextUseTheme,
} from "next-themes";
import {
    createContext,
    useContext,
    useMemo,
    type ReactNode,
} from "react";

import { createThemeOptions } from "@/components/theme/CreateFromPalette";

export type ThemeMode = "dark" | "light" | "system";

export type ThemeContextState = {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextState | undefined>(undefined);

const muiTheme = createTheme(createThemeOptions());

export function BluzThemeProvider({
    children,
    ...props
}: ThemeProviderProps & { children: ReactNode }) {
    return (
        <NextThemesProvider
            {...props}
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange={false}
            enableSystem
        >
            <InnerThemeProvider>
                <CssBaseline />
                <GlobalStyles
                    styles={(theme) => ({
                        "*::-webkit-scrollbar": {
                            width: "8px",
                            height: "8px",
                        },
                        "*::-webkit-scrollbar-track": {
                            background: "transparent",
                        },
                        "*::-webkit-scrollbar-thumb": {
                            backgroundColor:
                                theme.vars.palette.action.disabledBackground,
                            borderRadius: "8px",
                        },
                        "*::-webkit-scrollbar-thumb:hover": {
                            backgroundColor: theme.vars.palette.primary.main,
                        },
                        "*::-webkit-scrollbar-corner": {
                            backgroundColor: "transparent",
                        },
                        "*::-webkit-scrollbar-button": {
                            display: "none",
                        },
                    })}
                />
                {children}
            </InnerThemeProvider>
        </NextThemesProvider>
    );
}

function InnerThemeProvider({ children }: { children: ReactNode }) {
    const { theme, setTheme } = nextUseTheme();

    const contextValue = useMemo(
        () => ({
            theme: (theme as ThemeMode) ?? "system",
            setTheme: setTheme as (theme: ThemeMode) => void,
        }),
        [theme, setTheme],
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            <MUIThemeProvider theme={muiTheme}>{children}</MUIThemeProvider>
        </ThemeContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a BluzThemeProvider");
    }
    return context;
};
