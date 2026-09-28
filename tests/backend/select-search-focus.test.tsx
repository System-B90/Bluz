// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { EntitySelect } from "@/components/base/EntitySelect";

/**
 * Searchable menus: a key meant for the search box, pressed while a menu item
 * has focus, returns focus to the search box instead of driving the list.
 */

const OPTIONS = [
    { id: "1", name: "אלגברה" },
    { id: "2", name: "גאומטריה" },
    { id: "3", name: "Physics" },
];

async function openOnItem() {
    render(
        <EntitySelect
            label="מקצוע"
            onChange={() => {}}
            options={OPTIONS}
            parseValue={String}
            searchable
            value={null}
        />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const search = await screen.findByPlaceholderText("חיפוש...");
    const item = screen.getByRole("option", { name: "Physics" });
    item.focus();
    return { search, item };
}

afterEach(cleanup);

describe("searchable select focus", () => {
    it.each([
        ["a printable character", { key: "g" }],
        ["/", { key: "/" }],
        ["Backspace", { key: "Backspace" }],
        ["Ctrl+A", { key: "a", ctrlKey: true }],
    ])("%s on an item focuses the search box", async (_, init) => {
        const { search, item } = await openOnItem();
        fireEvent.keyDown(item, init);
        expect(document.activeElement).toBe(search);
    });

    it("leaves arrow keys to the list", async () => {
        const { item } = await openOnItem();
        fireEvent.keyDown(item, { key: "ArrowUp" });
        expect(document.activeElement).not.toBe(
            screen.getByPlaceholderText("חיפוש..."),
        );
    });

    it("filters options by the typed query", async () => {
        const { search } = await openOnItem();
        await userEvent.type(search, "גא");
        expect(screen.queryByRole("option", { name: "אלגברה" })).toBeNull();
        expect(screen.getByRole("option", { name: "גאומטריה" })).toBeTruthy();
    });
});
