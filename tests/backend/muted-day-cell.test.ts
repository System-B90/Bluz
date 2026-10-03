import { createTheme } from "@mui/material/styles";
import { describe, expect, it } from "vitest";

import { mutedDayCellBackground } from "@/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell";
import { createThemeOptions } from "@/components/theme/CreateFromPalette";

/** The home-leave Saturday cell is a hatch on paper, not a faded grey block (#840). */

describe("mutedDayCellBackground", () => {
    it("is a light hatch driven by the scheme's text colour variable", () => {
        const bg = mutedDayCellBackground(createTheme(createThemeOptions()));
        expect(bg).toMatch(/^repeating-linear-gradient\(135deg/);
        expect(bg).toContain("--mui-palette-text-secondaryChannel");
    });
});
