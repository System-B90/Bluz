// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { enqueueApiErrorSnackbar, enqueueSnackbar } = vi.hoisted(() => ({
    enqueueApiErrorSnackbar: vi.fn(),
    enqueueSnackbar: vi.fn(),
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock("@/components/base/ApiErrorSnackbar", () => ({
    enqueueApiErrorSnackbar,
}));

import { useAsyncAction } from "@/components/gantt/curriculum-fab/action-items/use-async-action";
import { useGanttExpansion } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-expansion";

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("useGanttExpansion", () => {
    const render = (ids = [ "s1", "s2" ]) =>
        renderHook(() => useGanttExpansion(ids)).result;

    it("starts with every syllabus expanded and every module collapsed", () => {
        const result = render();

        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
        expect(result.current.isModuleExpanded("m1")).toBe(false);
        expect(result.current.allCollapsed).toBe(false);
    });

    it("toggles one syllabus without touching its siblings", () => {
        const result = render();

        act(() => result.current.toggleSyllabus("s1"));

        expect(result.current.isSyllabusExpanded("s1")).toBe(false);
        expect(result.current.isSyllabusExpanded("s2")).toBe(true);

        act(() => result.current.toggleSyllabus("s1"));
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
    });

    it("reports allCollapsed only once every syllabus is collapsed", () => {
        const result = render();

        act(() => result.current.toggleSyllabus("s1"));
        expect(result.current.allCollapsed).toBe(false);

        act(() => result.current.collapseAllSyllabuses());
        expect(result.current.allCollapsed).toBe(true);

        act(() => result.current.expandAllSyllabuses());
        expect(result.current.allCollapsed).toBe(false);
    });

    it("never reports allCollapsed for an empty tree", () => {
        const result = render([]);

        act(() => result.current.collapseAllSyllabuses());

        expect(result.current.allCollapsed).toBe(false);
    });

    it("exposeSyllabusFor only ever expands, and is a no-op when already open", () => {
        const result = render();

        act(() => result.current.collapseAllSyllabuses());
        act(() => result.current.exposeSyllabusFor("s1"));
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);

        act(() => result.current.exposeSyllabusFor("s1"));
        expect(result.current.isSyllabusExpanded("s1")).toBe(true);
        expect(result.current.isSyllabusExpanded("s2")).toBe(false);
    });

    it("expandModuleFor only ever expands, unlike toggleModule", () => {
        const result = render();

        act(() => result.current.expandModuleFor("m1"));
        act(() => result.current.expandModuleFor("m1"));
        expect(result.current.isModuleExpanded("m1")).toBe(true);

        act(() => result.current.toggleModule("m1"));
        expect(result.current.isModuleExpanded("m1")).toBe(false);
    });
});

describe("useAsyncAction", () => {
    it("brackets a successful call with the processing flag", async () => {
        const onProcessingChange = vi.fn();
        const onSuccess = vi.fn();
        const result = renderHook(() =>
            useAsyncAction(onProcessingChange),
        ).result;

        act(() =>
            result.current(async () => "ok", onSuccess, "נכשל"),
        );

        await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("ok"));
        expect(onProcessingChange.mock.calls).toEqual([ [ true ], [ false ] ]);
        expect(enqueueApiErrorSnackbar).not.toHaveBeenCalled();
    });

    it("reports a failure and still clears the processing flag", async () => {
        const onProcessingChange = vi.fn();
        const onSuccess = vi.fn();
        const error = new Error("boom");
        const result = renderHook(() =>
            useAsyncAction(onProcessingChange),
        ).result;

        act(() =>
            result.current(
                async () => {
                    throw error;
                },
                onSuccess,
                "נכשל",
            ),
        );

        await waitFor(() =>
            expect(enqueueApiErrorSnackbar).toHaveBeenCalledWith(
                enqueueSnackbar,
                "נכשל",
                error,
            ),
        );
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onProcessingChange).toHaveBeenLastCalledWith(false);
    });

    it("reports a failure thrown inside the success handler too", async () => {
        const onProcessingChange = vi.fn();
        const result = renderHook(() =>
            useAsyncAction(onProcessingChange),
        ).result;

        act(() =>
            result.current(
                async () => "ok",
                () => {
                    throw new Error("render failed");
                },
                "נכשל",
            ),
        );

        await waitFor(() =>
            expect(enqueueApiErrorSnackbar).toHaveBeenCalled(),
        );
        expect(onProcessingChange).toHaveBeenLastCalledWith(false);
    });
});
