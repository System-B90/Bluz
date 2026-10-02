import { useSyncExternalStore } from "react";

/** A per-viewer on/off flag kept in localStorage and shared by every component that reads it. */
function createViewerFlag(key: string, defaultValue: boolean)
{
    const listeners = new Set<() => void>();
    const read = (): boolean =>
    {
        try
        {
            const saved = typeof window === "undefined" ? null : window.localStorage.getItem(key);
            return saved === null ? defaultValue : saved === "on";
        } catch
        {
            return defaultValue;
        }
    };
    let value = read();
    const subscribe = (listener: () => void) =>
    {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    return {
        get: () => value,
        set: (next: boolean) =>
        {
            value = next;
            try
            {
                window.localStorage.setItem(key, next ? "on" : "off");
            } catch
            {
                // Best-effort: private browsing keeps it for this session only.
            }
            listeners.forEach((listener) => listener());
        },
        use: () => useSyncExternalStore(subscribe, () => value, () => defaultValue),
    };
}

/** Whether the gantt grid animates collapse/expand. On by default. */
const animation = createViewerFlag("bluz.gridAnimation", true);
export const setGridAnimation = animation.set;
export const useGridAnimation = animation.use;

/** Whether the gantt grid draws faint vertical lines between columns. Off by default. */
const verticalLines = createViewerFlag("bluz.gridVerticalLines", false);
export const setGridVerticalLines = verticalLines.set;
export const useGridVerticalLines = verticalLines.use;
