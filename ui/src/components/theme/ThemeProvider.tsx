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

import { createThemeOptions, focusRing } from "@/components/theme/CreateFromPalette";

// Build every color scheme once at module level — MUI CSS variables + the
// "class" selector switch the active palette without any JS re-render.
const muiTheme = createTheme({ ...createThemeOptions(), direction: "rtl" });

// Pink and pink-dark are light and dark in brightness, but they are separate
// colour schemes, so MUI would skip them for applyStyles("light" | "dark").
const BRIGHTNESS_TWIN = { light: "pink", dark: "pink-dark" } as const;
const baseApplyStyles = muiTheme.applyStyles;
muiTheme.applyStyles = function (key, styles)
{
    const own = baseApplyStyles.call(this, key, styles);
    if (key !== "light" && key !== "dark") return own;
    return { ...own, ...baseApplyStyles.call(this, BRIGHTNESS_TWIN[key], styles) };
};

export type Brightness = "dark" | "light";
export type Accent = "brand" | "pink";

/** Every theme next-themes may set as the `<html>` class (#765). */
export const THEMES = [ "light", "dark", "pink", "pink-dark" ] as const;

export type ThemeMode = "system" | (typeof THEMES)[number];

const THEME_BY_ACCENT: Record<Accent, Record<Brightness, ThemeMode>> = {
    brand: { light: "light", dark: "dark" },
    pink: { light: "pink", dark: "pink-dark" },
};

export type ThemeContextState = {
    /** Brightness only: pink is light, pink-dark is dark. */
    resolvedTheme: Brightness;
    accent: Accent;
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
    /** Switches light/dark and keeps the current accent. */
    setBrightness: (brightness: Brightness) => void;
    /** Switches brand/pink and keeps the current brightness. */
    setAccent: (accent: Accent) => void;
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
            themes={ [ ...THEMES ] }
        >
            <InnerThemeProvider>
                <CssBaseline />
                <GlobalStyles
                    styles={ (theme) => ({
                        // Non-MUI focusables (dnd-kit Gantt bars, custom
                        // role="button" cells) get the same ring as
                        // ButtonBase's .Mui-focusVisible (#824).
                        '[role="button"]:focus-visible, [tabindex]:not([tabindex="-1"]):focus-visible': focusRing(theme),
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
                            width: 0,
                            height: 0,
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

    const contextValue = useMemo<ThemeContextState>(
        () =>
        {
            const brightness: Brightness =
                resolvedTheme === "dark" || resolvedTheme === "pink-dark" ? "dark" : "light";
            const accent: Accent =
                resolvedTheme === "pink" || resolvedTheme === "pink-dark" ? "pink" : "brand";
            return {
                resolvedTheme: brightness,
                accent,
                theme: (theme as ThemeMode) ?? "system",
                setTheme,
                setBrightness: (next) => setTheme(THEME_BY_ACCENT[accent][next]),
                setAccent: (next) => setTheme(THEME_BY_ACCENT[next][brightness]),
            };
        },
        [ resolvedTheme, theme, setTheme ],
    );

    return (
        <ThemeContext.Provider value={ contextValue }>
            <MUIThemeProvider modeStorageKey="theme" theme={ muiTheme }>{ children }</MUIThemeProvider>
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
