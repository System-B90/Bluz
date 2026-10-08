// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The selected gantt tab follows `v=` both ways (#844): a stale URL rewrite
 * (the settings dialog's router.replace) must move the tab, not leave the URL
 * naming a different tab than the one shown.
 */

const { nav } = vi.hoisted(() => ({ nav: { search: "" } }));
vi.mock("next/navigation", () => ({
    usePathname: () => "/gantt",
    useSearchParams: () => new URLSearchParams(nav.search),
}));

import {
    parseGanttTabIndex,
    useGanttTabUrl,
} from "@/components/gantt/curriculum-view/use-gantt-tab-url";

function setUrl(search: string) {
    nav.search = search;
    window.history.replaceState(null, "", `/gantt${search ? `?${search}` : ""}`);
}

beforeEach(() => setUrl(""));
afterEach(cleanup);

describe("parseGanttTabIndex", () => {
    it.each([
        [ null, 0 ],
        [ "2", 2 ],
        [ "abc", 0 ],
        [ "-1", 0 ],
        [ "99", 0 ],
    ])("maps %s to %i", (raw, expected) => {
        expect(parseGanttTabIndex(raw)).toBe(expected);
    });
});

describe("useGanttTabUrl (#844)", () => {
    it("opens the tab named in the URL", () => {
        setUrl("c=x&v=1");
        const { result } = renderHook(() => useGanttTabUrl());
        expect(result.current[ 0 ]).toBe(1);
    });

    it("writes the selected tab to the URL, keeping other params", () => {
        setUrl("c=x&v=1");
        const { result } = renderHook(() => useGanttTabUrl());
        act(() => result.current[ 1 ](2));
        const params = new URLSearchParams(window.location.search);
        expect(params.get("v")).toBe("2");
        expect(params.get("c")).toBe("x");
    });

    it("follows an external rewrite of v (the stale settings-dialog replace)", () => {
        setUrl("v=1");
        const { result, rerender } = renderHook(() => useGanttTabUrl());
        act(() => result.current[ 1 ](0));
        expect(new URLSearchParams(window.location.search).get("v")).toBe("0");
        // Next syncs useSearchParams with history.replaceState.
        nav.search = window.location.search.slice(1);
        rerender();
        expect(result.current[ 0 ]).toBe(0);

        // The dialog's close builds its URL from params read before the switch.
        setUrl("v=1");
        rerender();
        expect(result.current[ 0 ]).toBe(1);
        expect(new URLSearchParams(window.location.search).get("v")).toBe("1");
    });

    it("ignores a late echo of its own earlier write (#896, #897)", () => {
        const { result, rerender } = renderHook(() => useGanttTabUrl());
        expect(new URLSearchParams(window.location.search).get("v")).toBe("0");

        // The user picks a tab before useSearchParams has caught up with the
        // landing write of v=0.
        act(() => result.current[ 1 ](3));
        expect(new URLSearchParams(window.location.search).get("v")).toBe("3");

        // Now the stale v=0 arrives, then the current v=3.
        nav.search = "v=0";
        rerender();
        expect(result.current[ 0 ]).toBe(3);
        nav.search = "v=3";
        rerender();
        expect(result.current[ 0 ]).toBe(3);
        expect(new URLSearchParams(window.location.search).get("v")).toBe("3");
    });

    it("adds v to a landing URL that has none", () => {
        renderHook(() => useGanttTabUrl());
        expect(new URLSearchParams(window.location.search).get("v")).toBe("0");
    });
});
