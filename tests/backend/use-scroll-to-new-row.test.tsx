// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollToNewRow } from "@/components/base/use-scroll-to-new-row";

/** A created or duplicated row scrolls into view; opening the list does not. */

const anchorId = (id: string) => `row-${id}`;

function setup(ids: Array<string>) {
    const container = document.createElement("div");
    const scrolled: Array<string> = [];
    for (const id of ["a", "b", "c", "d"]) {
        const row = document.createElement("div");
        row.id = anchorId(id);
        row.scrollIntoView = () => scrolled.push(id);
        container.appendChild(row);
    }
    const containerRef = { current: container };
    const hook = renderHook(
        ({ list }) => useScrollToNewRow(list, containerRef, anchorId),
        { initialProps: { list: ids } },
    );
    return { hook, scrolled };
}

describe("useScrollToNewRow", () => {
    beforeEach(() => {
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            cb(0);
            return 0;
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it("does not scroll on first render", () => {
        const { scrolled } = setup(["a", "b"]);
        expect(scrolled).toEqual([]);
    });

    it("scrolls to an appended row", () => {
        const { hook, scrolled } = setup(["a", "b"]);
        hook.rerender({ list: ["a", "b", "c"] });
        expect(scrolled).toEqual(["c"]);
    });

    it("scrolls to a duplicate inserted mid-list", () => {
        const { hook, scrolled } = setup(["a", "b"]);
        hook.rerender({ list: ["a", "d", "b"] });
        expect(scrolled).toEqual(["d"]);
    });

    it("ignores reorders and removals", () => {
        const { hook, scrolled } = setup(["a", "b", "c"]);
        hook.rerender({ list: ["c", "a", "b"] });
        hook.rerender({ list: ["c", "a"] });
        expect(scrolled).toEqual([]);
    });
});
