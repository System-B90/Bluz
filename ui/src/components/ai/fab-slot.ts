import { useEffect, useSyncExternalStore } from "react";

/**
 * Whether a FAB occupies the bottom corner under the AI launcher. The Gantt
 * screen's curriculum FAB reserves it while mounted; elsewhere the launcher
 * drops to the page bottom instead of floating over an empty slot.
 */
let reservations = 0;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Reserves the slot under the AI launcher for as long as the caller is mounted. */
export function useReserveAiFabSlot(): void {
    useEffect(() => {
        reservations += 1;
        emit();
        return () => {
            reservations -= 1;
            emit();
        };
    }, []);
}

/** True while another FAB sits under the AI launcher. */
export function useAiFabSlotTaken(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => reservations > 0,
        () => false,
    );
}
