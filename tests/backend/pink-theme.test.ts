import { createTheme, getContrastRatio } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { createThemeOptions, PINK_PALETTE } from "@/components/theme/CreateFromPalette";

/**
 * Pink modes (#765): pink and pink-dark, next to light and dark. The pink
 * must be rose rather than neon, and still readable.
 */
describe("pink colour scheme", () => {
    const theme = createTheme({ ...createThemeOptions(), direction: "rtl" });

    it("is registered as a light scheme next to light, dark and pink-dark", () => {
        expect(Object.keys(theme.colorSchemes).sort()).toEqual([ "dark", "light", "pink", "pink-dark" ]);
        expect(theme.colorSchemes.pink?.palette.mode).toBe("light");
        expect(theme.colorSchemes.pink?.palette.primary.main).toBe(PINK_PALETTE.primary.main);
    });

    it("emits its CSS variables under the `.pink` class next-themes sets", () => {
        const css = JSON.stringify(theme.generateStyleSheets());
        expect(css).toContain(".pink");
        expect(css).toContain(PINK_PALETTE.background.default);
    });

    it("keeps body text readable (WCAG AA) on both backgrounds", () => {
        for (const bg of [ PINK_PALETTE.background.default, PINK_PALETTE.background.paper ]) {
            expect(getContrastRatio(PINK_PALETTE.text.primary, bg)).toBeGreaterThanOrEqual(4.5);
            expect(getContrastRatio(PINK_PALETTE.text.secondary, bg)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("keeps button labels readable", () => {
        for (const c of [ PINK_PALETTE.primary, PINK_PALETTE.secondary ]) {
            expect(getContrastRatio(c.contrastText, c.main)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("is a rose pink, not neon: the primary is moderately saturated", () => {
        const hex = PINK_PALETTE.primary.main.slice(1);
        const [ r, g, b ] = [ 0, 2, 4 ].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturationHsv = (max - min) / max;
        expect(r).toBe(max); // a red-family hue
        // Aurora rose #E0629A sits at 0.56; neon pinks like #FF1493 are 0.92.
        expect(saturationHsv).toBeLessThan(0.6);
    });
});
