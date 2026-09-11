"use client";

import { useCallback, useEffect, useRef } from "react";

/** The modifier-driven modes a grid drag can be in. Independent of each other. */
export type DragModifiers = {
    /** Ctrl/Cmd: the drag places a copy and leaves the original alone (#575). */
    duplicate: boolean;
    /** Alt: quarter-speed, minute-snapped movement (#475, moved to Alt by #608). */
    precise: boolean;
};

export const NO_MODIFIERS: DragModifiers = { duplicate: false, precise: false };

const MODIFIER_KEYS = new Set([ "Control", "Meta", "Alt", "Shift" ]);

export function readDragModifiers(
    event: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">,
): DragModifiers {
    return { duplicate: event.ctrlKey || event.metaKey, precise: event.altKey };
}

function sameModifiers(a: DragModifiers, b: DragModifiers): boolean {
    return a.duplicate === b.duplicate && a.precise === b.precise;
}

/**
 * Live modifier state for react-big-calendar drags, and the reason a modifier
 * can be pressed mid-drag at all.
 *
 * The library's `Selection` helper registers a document-level `keydown`
 * listener at mousedown that *terminates the interaction on any key* — it is
 * meant for Escape, but it fires for Ctrl and Alt too, so pressing a modifier
 * once the drag was under way silently ended it (and the auto-repeat of a
 * modifier held from before the mousedown ended it a moment later). While a
 * drag is in flight, modifier keydowns are therefore swallowed in the capture
 * phase on `window`, which runs before the document listener. Escape and every
 * other key still reach the library untouched.
 *
 * The drop callbacks carry only computed dates, never the DOM event, so the
 * modifier state is read from live keyboard/pointer events: `keydown`/`keyup`
 * always (so a key held before the mousedown is known at drag start), and
 * `mousemove` while dragging (so a change made with the pointer still is
 * picked up without waiting for a key event).
 *
 * @param dragging Whether a grid drag is currently in flight.
 * @param onChange Called with the new modifier set whenever it changes during
 *                 a drag — the caller mirrors it into the drag preview state.
 * @returns A stable reader of the modifiers currently held, drag or no drag.
 */
export function useDragModifiers(
    dragging: boolean,
    onChange: (modifiers: DragModifiers) => void,
): () => DragModifiers {
    const held = useRef<DragModifiers>(NO_MODIFIERS);
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [ onChange ]);

    useEffect(() => {
        const apply = (next: DragModifiers) => {
            if (sameModifiers(held.current, next)) return;
            held.current = next;
            if (dragging) onChangeRef.current(next);
        };
        const onKey = (event: KeyboardEvent) => {
            apply(readDragModifiers(event));
            if (dragging && MODIFIER_KEYS.has(event.key)) {
                // Keeps the library's keydown terminator (and, for Alt, the
                // browser's menu-bar focus) out of a drag in progress.
                event.preventDefault();
                event.stopPropagation();
            }
        };
        const onMove = (event: MouseEvent) => apply(readDragModifiers(event));
        // A window that loses focus mid-drag never sees the keyup.
        const onBlur = () => apply(NO_MODIFIERS);

        window.addEventListener("keydown", onKey, true);
        window.addEventListener("keyup", onKey, true);
        window.addEventListener("blur", onBlur);
        if (dragging) window.addEventListener("mousemove", onMove);
        return () => {
            window.removeEventListener("keydown", onKey, true);
            window.removeEventListener("keyup", onKey, true);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("mousemove", onMove);
        };
    }, [ dragging ]);

    return useCallback(() => held.current, []);
}
