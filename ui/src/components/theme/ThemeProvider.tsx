"use client";

import { GlobalStyles } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
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
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createFromPalette } from "@/components/theme/CreateFromPalette";

export type ThemeMode = "dark" | "light" | "system";

export type ThemeContextState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextState | undefined>(undefined);

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
              backgroundColor: theme.palette.action.disabledBackground,
              borderRadius: "8px",
            },
            "*::-webkit-scrollbar-thumb:hover": {
              backgroundColor: theme.palette.primary.main,
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
  const { theme, setTheme, resolvedTheme } = nextUseTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const paletteMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const muiTheme = useMemo(
    () => createTheme(createFromPalette(paletteMode)),
    [paletteMode],
  );

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
