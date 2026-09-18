import { useSnackbar } from "notistack";
import { useCallback, useEffect, useRef } from "react";

/**
 * Undo support for drag actions in the gantt timeline (#142). Keeps a bounded
 * stack of inverse operations; Ctrl+Z / Cmd+Z (outside text inputs) pops and
 * executes the most recent one while the timeline is mounted.
 */

/** Maximum drag actions remembered for Ctrl+Z. */
const UNDO_STACK_LIMIT = 50;

/**
 * True when the keystroke belongs to something other than the timeline: a
 * text-entry element, a MUI Select/Autocomplete (which take focus without
 * being an input), or any open dialog. With the event dialog open over the
 * timeline and focus on one of its selects, Ctrl+Z used to undo the last
 * *drag* on the timeline behind it — invisible under the dialog, and
 * already committed to the server by the time it was noticed.
 */
function isTypingTarget(target: EventTarget | null): boolean
{
    if (document.querySelector(".MuiDialog-root") !== null) return true;
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest('[role="combobox"], [role="listbox"], [role="textbox"]') !==
            null
    );
}

export function useGanttUndo()
{
    const { enqueueSnackbar } = useSnackbar();
    const undoStackRef = useRef<Array<() => Promise<void>>>([]);

    const pushUndo = useCallback((undo: () => Promise<void>) =>
    {
        undoStackRef.current.push(undo);
        if (undoStackRef.current.length > UNDO_STACK_LIMIT)
        {
            undoStackRef.current.shift();
        }
    }, []);

    const handleUndo = useCallback(async () =>
    {
        const undo = undoStackRef.current.pop();
        if (!undo) return;
        try
        {
            await undo();
            enqueueSnackbar("הפעולה האחרונה בוטלה", { variant: "info" });
        } catch
        {
            enqueueSnackbar("ביטול הפעולה נכשל!", { variant: "error" });
        }
    }, [ enqueueSnackbar ]);

    useEffect(() =>
    {
        const onKeyDown = (e: KeyboardEvent) =>
        {
            if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
            if (e.key.toLowerCase() !== "z") return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            void handleUndo();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [ handleUndo ]);

    return { pushUndo, handleUndo };
}
