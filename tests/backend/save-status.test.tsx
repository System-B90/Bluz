// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SaveStatusIndicator, useSaveStatus } from "@/components/base/SaveStatus";

/** The syllabus dialog's autosave status (#836). */

afterEach(cleanup);

function deferred() {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("useSaveStatus", () => {
    it("goes idle → saving → saved", async () => {
        const { result } = renderHook(() => useSaveStatus());
        expect(result.current.status).toBe("idle");
        const save = deferred();
        act(() => void result.current.track(save.promise));
        expect(result.current.status).toBe("saving");
        await act(async () => save.resolve());
        expect(result.current.status).toBe("saved");
    });

    it("reports a failed save", async () => {
        const { result } = renderHook(() => useSaveStatus());
        const save = deferred();
        act(() => void result.current.track(save.promise).catch(() => undefined));
        await act(async () => save.reject(new Error("boom")));
        expect(result.current.status).toBe("error");
    });

    it("lets only the latest of overlapping saves decide", async () => {
        const { result } = renderHook(() => useSaveStatus());
        const first = deferred();
        const second = deferred();
        act(() => {
            void result.current.track(first.promise).catch(() => undefined);
            void result.current.track(second.promise);
        });
        await act(async () => second.resolve());
        await act(async () => first.reject(new Error("late")));
        expect(result.current.status).toBe("saved");
    });
});

describe("SaveStatusIndicator", () => {
    it("announces the state politely", () => {
        render(<SaveStatusIndicator status="saved" />);
        const status = screen.getByRole("status");
        expect(status.getAttribute("aria-live")).toBe("polite");
        expect(status.textContent).toBe("נשמר");
    });

    it("is empty while idle", () => {
        render(<SaveStatusIndicator status="idle" />);
        expect(screen.getByRole("status").textContent).toBe("");
    });
});
