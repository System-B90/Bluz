/** How much of the pointer's time delta a precision drag actually applies. */
const PRECISION_FACTOR = 0.25;

/** Damped drags round to the minute rather than to the grid's 5-minute step. */
const PRECISION_SNAP_MS = 60_000;

/**
 * The delta a drag of `deltaMs` on screen should actually apply. Pure, so the
 * damping rule is testable without a pointer.
 *
 * Alt-held drags move (or resize) an event a quarter as far as the pointer
 * travelled and land on whole minutes (#475). The grid snaps to 5 minutes,
 * which is coarse for a small correction and forces the user to fight the
 * snap; holding Alt trades reach for resolution without changing the grid.
 *
 * The modifier used to be Ctrl, which is claimed by "duplicate the dragged
 * event" — so a Ctrl+drag duplicate landed at a quarter of the intended offset
 * (#608). Precision moved to Alt; duplicate keeps Ctrl. Both are read live by
 * `useDragModifiers`, and the drag preview applies this same rule so what is
 * drawn mid-drag is exactly what lands on drop.
 */
export function dampDragDelta(deltaMs: number, isPrecise: boolean): number {
    if (!isPrecise) return deltaMs;
    return (
        Math.round((deltaMs * PRECISION_FACTOR) / PRECISION_SNAP_MS) *
        PRECISION_SNAP_MS
    );
}
