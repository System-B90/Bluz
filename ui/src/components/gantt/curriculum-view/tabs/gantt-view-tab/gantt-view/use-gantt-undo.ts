import { useSnackbar } from "notistack";
import { useCallback, useEffect, useRef } from "react";

/**
 * Undo support for drag actions in the gantt timeline (#142). Keeps a bounded
 * stack of inverse operations; Ctrl+Z / Cmd+Z (outside text inputs) pops and
 * executes the most recent one while the timeline is mounted.
 */

/** Maximum drag actions remembered for Ctrl+Z. */
const UNDO_STACK_LIMIT = 50;

/** True when the keystroke happened inside a text-entry element. */
function isTypingTarget(target: EventTarget | null): boolean
{
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
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
