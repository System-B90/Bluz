// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A tall event (many shuffles, a long history) must stay reachable. The
 * dialog's Paper is a flex column that the theme clips with
 * `overflow: hidden` to keep its rounded corners, so the only thing that can
 * scroll is DialogContent — and it can only scroll if the `<form>` between it
 * and the Paper is itself a shrinkable flex column. A plain `<form>` grows to
 * its content, DialogContent never overflows, and everything below the fold is
 * clipped away with no scrollbar. jsdom does no layout, so this asserts the
 * CSS contract that makes the scroll possible rather than the pixels.
 */

vi.mock("@/components/schedule/event-dialog/EventPrimaryDetails", () => ({
    EventPrimaryDetails: () => <div />,
}));
vi.mock("@/components/schedule/event-dialog/EventClassification", () => ({
    EventClassification: () => <div />,
}));
vi.mock("@/components/schedule/event-dialog/InstructorsField", () => ({
    InstructorsField: () => <div />,
}));
vi.mock("@/components/schedule/event-dialog/EventToggles", () => ({
    EventToggles: () => <div />,
}));
vi.mock("@/components/schedule/event-dialog/HiveQueueMapping", () => ({
    HiveQueueMapping: () => <div />,
}));
vi.mock("@/components/schedule/event-dialog/event-history", () => ({
    EventHistoryPanel: () => <div />,
}));
import { EventDialog } from "@/components/schedule/event-dialog";

const noop = () => {};

function renderDialog() {
    render(
        <EventDialog
            event={{ name: "מופע" }}
            onClose={noop}
            onDelete={noop}
            onSave={noop}
            open
        />,
    );
    const form = document.querySelector("form");
    if (!form) throw new Error("dialog rendered without a form");
    return form;
}

afterEach(cleanup);

describe("EventDialog scrolling", () => {
    it("lets the form shrink under the Paper's max height", () => {
        const style = getComputedStyle(renderDialog());

        expect(style.display).toBe("flex");
        expect(style.flexDirection).toBe("column");
        // The whole point: `auto` (the default) would size the form to its
        // content and defeat the Paper's max-height.
        expect(parseFloat(style.minHeight)).toBe(0);
    });

    it("puts the scrollbar on the content, not the clipped Paper", () => {
        const form = renderDialog();
        const content = form.querySelector(".MuiDialogContent-root");

        expect(content).not.toBeNull();
        const style = getComputedStyle(content!);
        expect(style.overflowY).toBe("auto");
        expect(parseFloat(style.minHeight)).toBe(0);
    });

    it("keeps the actions outside the scrolling area", () => {
        const form = renderDialog();
        const content = form.querySelector(".MuiDialogContent-root");

        // Save/cancel must stay pinned while the content scrolls.
        expect(
            content!.contains(screen.getByRole("button", { name: "שמירה" })),
        ).toBe(false);
    });
});
