import { useSyncExternalStore } from "react";

/** A per-viewer value kept in localStorage and shared by every component that reads it. */
export function createViewerSetting<T>(
    key: string,
    defaultValue: T,
    /** Stored text → value; null (nothing stored) never reaches it. */
    parse: (saved: string) => T,
    /** Value → stored text; null removes the key. */
    format: (value: T) => null | string,
)
{
    const listeners = new Set<() => void>();
    const read = (): T =>
    {
        try
        {
            const saved = typeof window === "undefined" ? null : window.localStorage.getItem(key);
            return saved === null ? defaultValue : parse(saved);
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
        set: (next: T) =>
        {
            value = next;
            try
            {
                const text = format(next);
                if (text === null) window.localStorage.removeItem(key);
                else window.localStorage.setItem(key, text);
            } catch
            {
                // Best-effort: private browsing keeps it for this session only.
            }
            listeners.forEach((listener) => listener());
        },
        use: () => useSyncExternalStore(subscribe, () => value, () => defaultValue),
    };
}

/** A per-viewer on/off flag kept in localStorage and shared by every component that reads it. */
export const createViewerFlag = (key: string, defaultValue: boolean) =>
    createViewerSetting(key, defaultValue, (saved) => saved === "on", (on) => (on ? "on" : "off"));

/** Whether the gantt grid animates collapse/expand. On by default. */
const animation = createViewerFlag("bluz.gridAnimation", true);
export const setGridAnimation = animation.set;
export const useGridAnimation = animation.use;

/** Whether the gantt grid leaves break events out of its rows and sums. Off by default (breaks counted). */
const ignoreBreaks = createViewerFlag("bluz.gridIgnoreBreaks", false);
export const setGridIgnoreBreaks = ignoreBreaks.set;
export const useGridIgnoreBreaks = ignoreBreaks.use;

/** Whether the grid's available/allotted header rows fold into one "allotted / available" row. Off by default. */
const compactHeader = createViewerFlag("bluz.gridCompactHeader", false);
export const setGridCompactHeader = compactHeader.set;
export const useGridCompactHeader = compactHeader.use;

/** Whether the gantt grid draws faint vertical lines between columns. Off by default. */
const verticalLines = createViewerFlag("bluz.gridVerticalLines", false);
export const setGridVerticalLines = verticalLines.set;
export const useGridVerticalLines = verticalLines.use;
