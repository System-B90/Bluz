import Button from "@mui/material/Button";
import { SnackbarKey, useSnackbar } from "notistack";
import { useCallback, useEffect, useRef } from "react";

/**
 * Undo/redo for drag actions in the gantt timeline (#142, #809). Keeps a
 * bounded stack of actions, each with its inverse. While the timeline is
 * mounted (outside text inputs and dialogs):
 * - Ctrl/Cmd+Z undoes the most recent action.
 * - Ctrl/Cmd+Shift+Z or Ctrl+Y redoes it.
 * Keys are matched by physical position (`KeyboardEvent.code`), so the
 * shortcuts also work with the Hebrew layout, where Z types "ז".
 */

/** Maximum drag actions remembered for Ctrl+Z. */
const UNDO_STACK_LIMIT = 50;

/** A committed action. A step resolving `false` failed (and reported why). */
export type UndoEntry = {
    /** What happened, in the user's words: "<name> הועבר ליום שני 3.8". */
    label: string;
    undo: () => Promise<boolean | void>;
    redo: () => Promise<boolean | void>;
};

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

/** Which history shortcut a keystroke is, if any. Layout-independent. */
export function historyShortcutOf(
    e: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
): "redo" | "undo" | null
{
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
    // `code` is empty for some synthetic events; fall back to the character.
    const isZ = e.code ? e.code === "KeyZ" : e.key.toLowerCase() === "z";
    const isY = e.code ? e.code === "KeyY" : e.key.toLowerCase() === "y";
    if (isZ) return e.shiftKey ? "redo" : "undo";
    if (isY && !e.shiftKey) return "redo";
    return null;
}

async function succeeded(step: () => Promise<boolean | void>): Promise<boolean>
{
    try
    {
        return (await step()) !== false;
    } catch
    {
        return false;
    }
}

export function useGanttUndo()
{
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const undoStackRef = useRef<Array<UndoEntry>>([]);
    const redoStackRef = useRef<Array<UndoEntry>>([]);
    const lastSnackbarRef = useRef<SnackbarKey | undefined>(undefined);

    const pushUndo = useCallback((entry: UndoEntry) =>
    {
        undoStackRef.current.push(entry);
        if (undoStackRef.current.length > UNDO_STACK_LIMIT)
        {
            undoStackRef.current.shift();
        }
        // A new action forks history: what was undone can't be redone onto it.
        redoStackRef.current = [];
    }, []);

    const handleUndo = useCallback(async () =>
    {
        const entry = undoStackRef.current.pop();
        if (!entry) return;
        if (await succeeded(entry.undo))
        {
            redoStackRef.current.push(entry);
            enqueueSnackbar(`בוטל: ${entry.label}`, { variant: "info" });
        } else
        {
            enqueueSnackbar("ביטול הפעולה נכשל!", { variant: "error" });
        }
    }, [ enqueueSnackbar ]);

    const handleRedo = useCallback(async () =>
    {
        const entry = redoStackRef.current.pop();
        if (!entry) return;
        if (await succeeded(entry.redo))
        {
            undoStackRef.current.push(entry);
            enqueueSnackbar(`בוצע שוב: ${entry.label}`, { variant: "info" });
        } else
        {
            enqueueSnackbar("ביצוע הפעולה מחדש נכשל!", { variant: "error" });
        }
    }, [ enqueueSnackbar ]);

    /**
     * Records a just-committed action and confirms it with a snackbar whose
     * "בטל" button undoes it — the visible counterpart of Ctrl+Z (#809, #810).
     */
    const commit = useCallback((entry: UndoEntry) =>
    {
        pushUndo(entry);
        if (lastSnackbarRef.current !== undefined) closeSnackbar(lastSnackbarRef.current);
        lastSnackbarRef.current = enqueueSnackbar(entry.label, {
            variant: "success",
            action: (key) => (
                <Button
                    color="inherit"
                    onClick={ () =>
                    {
                        closeSnackbar(key);
                        // Only the latest action undoes in place; an older
                        // one would be undone out of order.
                        if (undoStackRef.current.at(-1) === entry) void handleUndo();
                    } }
                    size="small"
                    title="Ctrl+Z"
                >
                    בטל
                </Button>
            ),
        });
    }, [ pushUndo, enqueueSnackbar, closeSnackbar, handleUndo ]);

    useEffect(() =>
    {
        const onKeyDown = (e: KeyboardEvent) =>
        {
            const shortcut = historyShortcutOf(e);
            if (!shortcut) return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            void (shortcut === "undo" ? handleUndo() : handleRedo());
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [ handleUndo, handleRedo ]);

    return { pushUndo, commit, handleUndo, handleRedo };
}

export type GanttUndo = ReturnType<typeof useGanttUndo>;
