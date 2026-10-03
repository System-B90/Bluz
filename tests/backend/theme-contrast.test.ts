import { createTheme, getContrastRatio } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { CONTRAST_COLORS, createThemeOptions } from "@/components/theme/CreateFromPalette";

/**
 * WCAG AA contrast of the theme's text colours, in both schemes
 * (#807 turquoise text, #826 dark-mode red, #827 orange badges, #824 focus ring).
 */

const theme = createTheme(createThemeOptions());
const light = theme.colorSchemes.light!.palette;
const dark = theme.colorSchemes.dark!.palette;
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe("light scheme", () => {
    const surfaces = [ light.background.paper, light.background.default ];

    it("primary-as-text is readable on paper and page (#807)", () => {
        expect(light.primaryText.main).toBe(CONTRAST_COLORS.lightPrimaryText);
        for (const bg of surfaces) expect(getContrastRatio(light.primaryText.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("keeps the brand turquoise as the fill colour", () => {
        expect(light.primary.main).toBe("#67C8DD");
    });

    it("warning works as text on white and as a badge under white text (#827)", () => {
        for (const bg of surfaces) expect(getContrastRatio(light.warning.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(getContrastRatio(light.warning.main, light.warning.contrastText)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("error text stays readable", () => {
        for (const bg of surfaces) expect(getContrastRatio(light.error.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("the focus ring is visible (#824)", () => {
        for (const bg of surfaces) expect(getContrastRatio(light.primaryText.main, bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
});

describe("dark scheme", () => {
    const surfaces = [ dark.background.paper, dark.background.default ];

    it("red over-capacity numbers clear 4.5:1 (#826)", () => {
        expect(dark.error.main).toBe(CONTRAST_COLORS.darkError);
        for (const bg of surfaces) expect(getContrastRatio(dark.error.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("primary-as-text and warning are readable", () => {
        for (const bg of surfaces) {
            expect(getContrastRatio(dark.primaryText.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
            expect(getContrastRatio(dark.warning.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
        }
        expect(getContrastRatio(dark.warning.main, dark.warning.contrastText)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it("error badges keep readable label text", () => {
        expect(getContrastRatio(dark.error.main, dark.error.contrastText)).toBeGreaterThanOrEqual(AA_TEXT);
    });
});
