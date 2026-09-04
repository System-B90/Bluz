// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
    useSearchParams: () => currentSearch,
}));

import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

function renderAt(query: string) {
    currentSearch = new URLSearchParams(query);
    return renderHook(() => useSettingsDialogUrl()).result;
}

/** The query the hook last pushed through `router.replace`. */
function replacedParams() {
    const [ href ] = replace.mock.calls.at(-1)!;
    return new URLSearchParams(String(href).replace(/^\?/, ""));
}

describe("useSettingsDialogUrl", () => {
    beforeEach(() => replace.mockReset());
    afterEach(() => vi.clearAllMocks());

    it("is closed with no settings param", () => {
        expect(renderAt("").current.isOpen).toBe(false);
    });

    it("opens on the requested tab", () => {
        const { current } = renderAt("settings=rooms");

        expect(current.isOpen).toBe(true);
        expect(current.activeTab).toBe("rooms");
    });

    it("opens on the default tab for an empty or unknown value", () => {
        expect(renderAt("settings=").current.activeTab).toBe("personal");
        expect(renderAt("settings=bogus").current.activeTab).toBe("personal");
        expect(renderAt("settings=bogus").current.isOpen).toBe(true);
    });

    it("still honours a bare legacy editRoom link", () => {
        const { current } = renderAt("editRoom=r1");

        expect(current.isOpen).toBe(true);
        expect(current.activeTab).toBe("rooms");
    });

    it("openDialog keeps unrelated params and sets the tab", () => {
        renderAt("it=2026-a").current.openDialog("colors");

        const params = replacedParams();
        expect(params.get("settings")).toBe("colors");
        expect(params.get("it")).toBe("2026-a");
    });

    it("openDialog defaults to the personal tab", () => {
        renderAt("").current.openDialog();

        expect(replacedParams().get("settings")).toBe("personal");
    });

    it("openDialog writes the deep-link target and clears stale ones", () => {
        renderAt("editOutsider=o9").current.openDialog("rooms", {
            editRoom: "r1",
        });

        const params = replacedParams();
        expect(params.get("editRoom")).toBe("r1");
        expect(params.get("editOutsider")).toBeNull();
    });

    it("setTab clears the other tab's edit param", () => {
        renderAt("settings=rooms&editRoom=r1").current.setTab("outsiders");

        const params = replacedParams();
        expect(params.get("settings")).toBe("outsiders");
        expect(params.get("editRoom")).toBeNull();
    });

    it("closeDialog drops the settings and edit params only", () => {
        renderAt("settings=rooms&editRoom=r1&it=2026-a").current.closeDialog();

        const params = replacedParams();
        expect(params.get("settings")).toBeNull();
        expect(params.get("editRoom")).toBeNull();
        expect(params.get("it")).toBe("2026-a");
    });

    it("never scrolls the page when rewriting the URL", () => {
        renderAt("").current.openDialog("global");

        expect(replace.mock.calls.at(-1)![ 1 ]).toEqual({ scroll: false });
    });
});
