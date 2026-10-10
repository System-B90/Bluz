import { createTheme, getContrastRatio } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { CONTRAST_COLORS, createThemeOptions } from "@/components/theme/CreateFromPalette";

/**
 * WCAG AA contrast of the theme's text colours, in every scheme
 * (#807 turquoise text, #826 dark-mode red, #827 orange badges, #824 focus ring,
 * #765 pink and pink-dark).
 */

const theme = createTheme(createThemeOptions());
const light = theme.colorSchemes.light!.palette;
const dark = theme.colorSchemes.dark!.palette;
const pink = theme.colorSchemes.pink!.palette;
const pinkDark = theme.colorSchemes["pink-dark"]!.palette;
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

describe("weeks-tab home-leave Saturday cell (#840)", () => {
    // The cell now sits on paper with full-opacity text.secondary / success text.
    for (const [ name, palette ] of [ [ "light", light ], [ "dark", dark ] ] as const) {
        it(`its day label and "יוצאים הביתה" pass AA in ${name} mode`, () => {
            expect(getContrastRatio(palette.text.secondary, palette.background.paper)).toBeGreaterThanOrEqual(AA_TEXT);
            expect(getContrastRatio(palette.success.main, palette.background.paper)).toBeGreaterThanOrEqual(AA_TEXT);
        });
    }
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

describe("pink schemes (#765)", () => {
    for (const [ name, palette ] of [ [ "pink", pink ], [ "pink-dark", pinkDark ] ] as const) {
        const surfaces = [ palette.background.paper, palette.background.default ];

        it(`${name}: text, primary-as-text and status colours are readable`, () => {
            for (const bg of surfaces) {
                expect(getContrastRatio(palette.text.primary, bg)).toBeGreaterThanOrEqual(AA_TEXT);
                expect(getContrastRatio(palette.text.secondary, bg)).toBeGreaterThanOrEqual(AA_TEXT);
                expect(getContrastRatio(palette.primaryText.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
                expect(getContrastRatio(palette.warning.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
                expect(getContrastRatio(palette.error.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
                expect(getContrastRatio(palette.success.main, bg)).toBeGreaterThanOrEqual(AA_TEXT);
            }
        });

        it(`${name}: no teal or blue leaks in from the brand schemes`, () => {
            const brand = [ "#67C8DD", CONTRAST_COLORS.lightPrimaryText, CONTRAST_COLORS.darkPrimaryText ];
            for (const colour of [ palette.primary.main, palette.primaryText.main, palette.info.main ]) {
                expect(brand).not.toContain(colour);
            }
        });
    }

    it("pink-dark is a dark scheme, pink a light one", () => {
        expect(pink.mode).toBe("light");
        expect(pinkDark.mode).toBe("dark");
    });
});
