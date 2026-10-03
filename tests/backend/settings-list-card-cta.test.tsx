// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsListCardContent } from "@/components/settings-dialog/tabs/global/common/ListCard";
import { createThemeOptions } from "@/components/theme/CreateFromPalette";

const theme = createTheme(createThemeOptions());

/** Settings lists: one primary CTA, in the gantt's primary colour (#847). */

afterEach(cleanup);

function renderEmpty(handleStartCreate = vi.fn()) {
    render(
        <ThemeProvider theme={theme}>
            <SettingsListCardContent
            addButtonLabel="הוספת איש חוץ"
            handleStartCreate={handleStartCreate}
            headerProps={{ icon: () => null, title: "אנשי חוץ", subtitle: "" }}
            items={[]}
            searchMessages={{ noMatches: "אין תוצאות", noEntries: "אין אנשי חוץ" }}
            searchPlaceholder="חיפוש"
            searchQuery=""
            setSearchQuery={() => {}}
            />
        </ThemeProvider>,
    );
    return handleStartCreate;
}

describe("SettingsListCardContent empty state", () => {
    it("shows a single create button, not a duplicate CTA", () => {
        renderEmpty();
        expect(screen.getByText("אין אנשי חוץ")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "התחילו כאן" })).toBeNull();
        expect(screen.getAllByRole("button", { name: /הוספת איש חוץ/ })).toHaveLength(1);
    });

    it("its create button uses the primary colour and still creates", () => {
        const create = renderEmpty();
        const add = screen.getByRole("button", { name: /הוספת איש חוץ/ });
        expect(add.className).toContain("MuiButton-colorPrimary");
        fireEvent.click(add);
        expect(create).toHaveBeenCalledTimes(1);
    });
});
