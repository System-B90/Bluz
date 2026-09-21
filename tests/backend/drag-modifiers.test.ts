// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDragModifiers } from "@/components/schedule/calendar/calendar/UseDragModifiers";

/**
 * The drag-scoped modifier tracker behind Ctrl+drag duplicate (#575) and
 * Alt+drag precision (#475/#608). The part that matters most is the guard:
 * react-big-calendar ends a drag on *any* document-level keydown, so a
 * modifier pressed mid-drag must never reach the document while dragging —
 * and Escape always must, or the user loses the way to cancel.
 */
function render(dragging: boolean) {
    const onChange = vi.fn();
    const hook = renderHook(
        ({ active }: { active: boolean }) => useDragModifiers(active, onChange),
        { initialProps: { active: dragging } },
    );
    return { ...hook, onChange };
}

function key(type: "keydown" | "keyup", key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init });
    act(() => {
        document.body.dispatchEvent(event);
    });
    return event;
}

afterEach(cleanup);

describe("useDragModifiers", () => {
    it("knows a modifier held before the drag started", () => {
        const { result } = render(false);

        key("keydown", "Control", { ctrlKey: true });
        expect(result.current()).toEqual({ duplicate: true, precise: false });

        key("keyup", "Control");
        expect(result.current()).toEqual({ duplicate: false, precise: false });
    });

    it("reports live changes only while a drag is in flight", () => {
        const { result, rerender, onChange } = render(false);

        key("keydown", "Alt", { altKey: true });
        expect(onChange).not.toHaveBeenCalled();

        rerender({ active: true });
        key("keyup", "Alt");
        key("keydown", "Control", { ctrlKey: true, altKey: true });
        expect(onChange).toHaveBeenLastCalledWith({ duplicate: true, precise: true });
        expect(result.current()).toEqual({ duplicate: true, precise: true });
    });

    it("picks a modifier change up from pointer movement mid-drag", () => {
        const { onChange } = render(true);

        act(() => {
            window.dispatchEvent(new MouseEvent("mousemove", { ctrlKey: true }));
        });

        expect(onChange).toHaveBeenLastCalledWith({ duplicate: true, precise: false });
    });

    it("keeps a mid-drag modifier keydown away from the document, but lets Escape through", () => {
        render(true);
        const seenByDocument = vi.fn();
        document.addEventListener("keydown", seenByDocument);

        const ctrl = key("keydown", "Control", { ctrlKey: true });
        const escape = key("keydown", "Escape");
        document.removeEventListener("keydown", seenByDocument);

        expect(ctrl.defaultPrevented).toBe(true);
        expect(seenByDocument).toHaveBeenCalledTimes(1);
        expect(seenByDocument.mock.calls[ 0 ][ 0 ]).toBe(escape);
        expect(escape.defaultPrevented).toBe(false);
    });

    it("lets modifier keys reach the document when nothing is being dragged", () => {
        render(false);
        const seenByDocument = vi.fn();
        document.addEventListener("keydown", seenByDocument);

        const ctrl = key("keydown", "Control", { ctrlKey: true });
        document.removeEventListener("keydown", seenByDocument);

        expect(seenByDocument).toHaveBeenCalledTimes(1);
        expect(ctrl.defaultPrevented).toBe(false);
    });

    it("forgets held modifiers when the window loses focus", () => {
        const { result, onChange } = render(true);

        key("keydown", "Control", { ctrlKey: true });
        act(() => window.dispatchEvent(new window.Event("blur")));

        expect(result.current()).toEqual({ duplicate: false, precise: false });
        expect(onChange).toHaveBeenLastCalledWith({ duplicate: false, precise: false });
    });
});
