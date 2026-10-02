import { useSyncExternalStore } from "react";

/**
 * Lets the page toolbar collapse or expand every row of the grid, which keeps
 * its expansion state to itself, and lets the grid report whether anything is
 * open so the button can show the right action.
 */
export type GridExpansionCommand = "collapse" | "expand";

let allCollapsed = false;
const stateListeners = new Set<() => void>();
const commandListeners = new Set<(command: GridExpansionCommand) => void>();

export function publishGridAllCollapsed(value: boolean): void
{
    if (value === allCollapsed) return;
    allCollapsed = value;
    stateListeners.forEach((listener) => listener());
}

export const useGridAllCollapsed = () =>
    useSyncExternalStore(
        (listener) =>
        {
            stateListeners.add(listener);
            return () => stateListeners.delete(listener);
        },
        () => allCollapsed,
        () => false,
    );

export const requestGridExpansion = (command: GridExpansionCommand): void =>
    commandListeners.forEach((listener) => listener(command));

export function onGridExpansionRequest(listener: (command: GridExpansionCommand) => void): () => void
{
    commandListeners.add(listener);
    return () => commandListeners.delete(listener);
}
