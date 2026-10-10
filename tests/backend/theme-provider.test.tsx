// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    BluzThemeProvider,
    muiTheme,
    useTheme,
    type ThemeContextState,
    type ThemeMode,
} from "@/components/theme/ThemeProvider";

/**
 * Pink modes (#765): pink and pink-dark are separate colour schemes that
 * behave as light and dark in brightness. The heart switches the accent and
 * keeps brightness; the slider switches brightness and keeps the accent.
 */

describe("applyStyles brightness twins", () => {
    const styles = { color: "red" };

    it("sends dark styles to pink-dark as well", () => {
        expect(muiTheme.applyStyles("dark", styles)).toEqual({
            "*:where(.dark) &": styles,
            "*:where(.pink-dark) &": styles,
        });
    });

    it("sends light styles to pink as well", () => {
        expect(muiTheme.applyStyles("light", styles)).toEqual({
            "*:where(.light) &": styles,
            "*:where(.pink) &": styles,
        });
    });

    it("leaves a direct pink-dark key alone", () => {
        expect(muiTheme.applyStyles("pink-dark", styles)).toEqual({
            "*:where(.pink-dark) &": styles,
        });
    });
});

describe("accent and brightness switching", () => {
    let context: ThemeContextState | undefined;

    function Probe()
    {
        context = useTheme();
        return null;
    }

    function renderWithStoredTheme(theme: ThemeMode)
    {
        localStorage.setItem("theme", theme);
        render(
            <BluzThemeProvider>
                <Probe />
            </BluzThemeProvider>,
        );
    }

    beforeEach(() => {
        // next-themes reads the system colour scheme on mount; jsdom has no
        // `matchMedia`.
        vi.stubGlobal(
            "matchMedia",
            vi.fn((query: string) => ({
                addEventListener: vi.fn(),
                addListener: vi.fn(),
                dispatchEvent: vi.fn(),
                matches: false,
                media: query,
                onchange: null,
                removeEventListener: vi.fn(),
                removeListener: vi.fn(),
            })),
        );
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
        document.documentElement.className = "";
        context = undefined;
    });

    it.each([
        [ "pink-dark", "dark", "pink" ],
        [ "pink", "light", "pink" ],
        [ "dark", "dark", "brand" ],
        [ "light", "light", "brand" ],
    ] as const)("reads %s as %s brightness with the %s accent", (stored, brightness, accent) => {
        renderWithStoredTheme(stored);

        expect(context?.resolvedTheme).toBe(brightness);
        expect(context?.accent).toBe(accent);
    });

    it.each([
        [ "dark", "pink", "pink-dark" ],
        [ "light", "pink", "pink" ],
        [ "pink-dark", "brand", "dark" ],
        [ "pink", "brand", "light" ],
    ] as const)("the heart turns %s into %s → %s", async (stored, accent, expected) => {
        renderWithStoredTheme(stored);

        act(() => context!.setAccent(accent));

        await waitFor(() => expect(document.documentElement.className).toBe(expected));
        expect(localStorage.getItem("theme")).toBe(expected);
    });

    it.each([
        [ "pink", "dark", "pink-dark" ],
        [ "pink-dark", "light", "pink" ],
        [ "light", "dark", "dark" ],
        [ "dark", "light", "light" ],
    ] as const)("the slider turns %s %s → %s", async (stored, brightness, expected) => {
        renderWithStoredTheme(stored);

        act(() => context!.setBrightness(brightness));

        await waitFor(() => expect(document.documentElement.className).toBe(expected));
        expect(localStorage.getItem("theme")).toBe(expected);
    });
});
