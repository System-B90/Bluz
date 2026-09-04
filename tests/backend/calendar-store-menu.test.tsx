// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarStoreMenu } from "@/components/schedule/calendar/calendar/CalendarStoreMenu";

/**
 * The popover behind both the shared-drafts and snapshots toolbar buttons.
 * Every guard here is a UX rule: no blank names, no double-firing a mutation
 * while one is in flight, and a list that refreshes each time it opens.
 */
type Entry = { id: string; label: string };

const entries: Array<Entry> = [
    { id: "d1", label: "טיוטה א" },
    { id: "d2", label: "טיוטה ב" },
];

function renderMenu(overrides: Partial<Record<string, unknown>> = {}) {
    const onCreate = vi.fn();
    const onRefresh = vi.fn();
    const onLoad = vi.fn();
    render(
        <CalendarStoreMenu<Entry>
            actions={ [
                {
                    tooltip: "טעינה",
                    icon: <span>⬇</span>,
                    onClick: (entry, close) => {
                        onLoad(entry.id);
                        close();
                    },
                },
            ] }
            busyId={ null }
            createIcon={ <span>+</span> }
            createLabel="שמירה"
            emptyText="אין טיוטות"
            entries={ entries }
            icon={ <span>📄</span> }
            loading={ false }
            nameLabel="שם הטיוטה"
            onCreate={ onCreate }
            onRefresh={ onRefresh }
            renderEntry={ (entry) => ({
                primary: entry.label,
                secondary: entry.id,
            }) }
            title="טיוטות משותפות"
            tooltip="טיוטות"
            { ...(overrides as object) }
        />,
    );
    return { onCreate, onRefresh, onLoad };
}

const openMenu = async () => {
    await userEvent.click(screen.getByRole("button", { name: /📄/ }));
};

afterEach(cleanup);

describe("CalendarStoreMenu", () => {
    it("refreshes the list every time the popover opens", async () => {
        const { onRefresh } = renderMenu();

        await openMenu();

        expect(onRefresh).toHaveBeenCalledTimes(1);
        expect(screen.getByText("טיוטות משותפות")).toBeDefined();
        expect(screen.getByText("טיוטה א")).toBeDefined();
    });

    it("keeps the create button disabled until a real name is typed", async () => {
        renderMenu();
        await openMenu();

        const create = screen.getByRole("button", { name: /שמירה/ });
        expect(create).toHaveProperty("disabled", true);

        fireEvent.change(screen.getByLabelText("שם הטיוטה"), {
            target: { value: "   " },
        });
        expect(create).toHaveProperty("disabled", true);

        fireEvent.change(screen.getByLabelText("שם הטיוטה"), {
            target: { value: "טיוטה חדשה" },
        });
        expect(create).toHaveProperty("disabled", false);
    });

    it("creates with the trimmed name and clears the field", async () => {
        const { onCreate } = renderMenu();
        await openMenu();

        const field = screen.getByLabelText("שם הטיוטה");
        fireEvent.change(field, { target: { value: "  טיוטה חדשה  " } });
        await userEvent.click(screen.getByRole("button", { name: /שמירה/ }));

        expect(onCreate).toHaveBeenCalledWith("טיוטה חדשה");
        expect((field as HTMLInputElement).value).toBe("");
    });

    it("creates on Enter in the name field", async () => {
        const { onCreate } = renderMenu();
        await openMenu();

        const field = screen.getByLabelText("שם הטיוטה");
        fireEvent.change(field, { target: { value: "בלחיצת אנטר" } });
        fireEvent.keyDown(field, { key: "Enter" });

        expect(onCreate).toHaveBeenCalledWith("בלחיצת אנטר");
    });

    it("does not create from an Enter on a blank field", async () => {
        const { onCreate } = renderMenu();
        await openMenu();

        fireEvent.keyDown(screen.getByLabelText("שם הטיוטה"), {
            key: "Enter",
        });

        expect(onCreate).not.toHaveBeenCalled();
    });

    it("runs a row action and dismisses the popover", async () => {
        const { onLoad } = renderMenu();
        await openMenu();

        await userEvent.click(screen.getAllByRole("button", { name: /⬇/ })[ 0 ]);

        expect(onLoad).toHaveBeenCalledWith("d1");
        expect(screen.queryByText("טיוטה א")).toBeNull();
    });

    it("disables every row action while one entry is mutating", async () => {
        renderMenu({ busyId: "d1" });
        await openMenu();

        for (const button of screen.getAllByRole("button", { name: /⬇/ })) {
            expect(button).toHaveProperty("disabled", true);
        }
    });

    it("shows the empty text when the store holds nothing", async () => {
        renderMenu({ entries: [] });
        await openMenu();

        expect(screen.getByText("אין טיוטות")).toBeDefined();
    });

    it("shows a spinner instead of the empty text while first loading", async () => {
        renderMenu({ entries: [], loading: true });
        await openMenu();

        expect(screen.queryByText("אין טיוטות")).toBeNull();
        expect(screen.getByRole("progressbar")).toBeDefined();
    });

    it("never opens while the button is disabled", async () => {
        const { onRefresh } = renderMenu({
            disabled: true,
            disabledTooltip: "בקרוב",
        });

        const button = screen.getByRole("button", { name: /📄/ });
        expect(button).toHaveProperty("disabled", true);
        fireEvent.click(button);

        expect(onRefresh).not.toHaveBeenCalled();
        expect(screen.queryByText("טיוטות משותפות")).toBeNull();
    });
});
