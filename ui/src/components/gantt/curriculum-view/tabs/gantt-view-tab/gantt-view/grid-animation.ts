import { useSyncExternalStore } from "react";

/** Whether the gantt grid animates collapse/expand. Per viewer, on by default. */
const KEY = "bluz.gridAnimation";
const listeners = new Set<() => void>();

function read(): boolean
{
    try
    {
        return typeof window === "undefined" || window.localStorage.getItem(KEY) !== "off";
    } catch
    {
        return true;
    }
}

let enabled = read();

export const getGridAnimation = (): boolean => enabled;

export function setGridAnimation(value: boolean): void
{
    enabled = value;
    try
    {
        window.localStorage.setItem(KEY, value ? "on" : "off");
    } catch
    {
        // Best-effort: private browsing keeps it for this session only.
    }
    listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) =>
{
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useGridAnimation = () => useSyncExternalStore(subscribe, getGridAnimation, () => true);
