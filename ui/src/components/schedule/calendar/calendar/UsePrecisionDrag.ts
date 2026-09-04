"use client";

import { useEffect, useRef } from "react";

/** How much of the pointer's time delta a precision drag actually applies. */
const PRECISION_FACTOR = 0.25;

/** Damped drags round to the minute rather than to the grid's 5-minute step. */
const PRECISION_SNAP_MS = 60_000;

/**
 * The delta a drag of `deltaMs` on screen should actually apply. Pure, so the
 * damping rule is testable without a pointer.
 */
export function dampDragDelta(deltaMs: number, isPrecise: boolean): number {
    if (!isPrecise) return deltaMs;
    return (
        Math.round((deltaMs * PRECISION_FACTOR) / PRECISION_SNAP_MS) *
        PRECISION_SNAP_MS
    );
}

/**
 * Alt-held drags move an event a quarter as far as the pointer travelled and
 * land on whole minutes (#475). The grid snaps to 5 minutes, which is coarse
 * for a small correction and forces the user to fight the snap; holding Alt
 * trades reach for resolution without changing the grid itself.
 *
 * The modifier used to be Ctrl, which UseCalendarHandlers already claims for
 * "duplicate the dragged event" — so a Ctrl+drag duplicate landed at a quarter
 * of the intended offset (#608). Precision moved to Alt; duplicate keeps Ctrl.
 *
 * The modifier is read from live keyboard/pointer state rather than from the
 * drop event, because react-big-calendar's drop callback carries only the
 * computed dates, not the DOM event that produced them.
 */
export function usePrecisionDrag() {
    const isPrecise = useRef(false);

    useEffect(() => {
        const sync = (event: KeyboardEvent | MouseEvent) => {
            isPrecise.current = event.altKey;
        };
        // A window that loses focus mid-drag never sees the keyup.
        const clear = () => {
            isPrecise.current = false;
        };
        window.addEventListener("keydown", sync);
        window.addEventListener("keyup", sync);
        window.addEventListener("mousemove", sync);
        window.addEventListener("blur", clear);
        return () => {
            window.removeEventListener("keydown", sync);
            window.removeEventListener("keyup", sync);
            window.removeEventListener("mousemove", sync);
            window.removeEventListener("blur", clear);
        };
    }, []);

    const applyPrecision = (deltaMs: number): number =>
        dampDragDelta(deltaMs, isPrecise.current);

    return { applyPrecision };
}
