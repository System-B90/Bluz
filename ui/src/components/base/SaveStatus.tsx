import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "error" | "idle" | "saved" | "saving";

/**
 * Tracks the autosaves of a save-on-blur form (#836): `track(promise)` flips
 * to "saving", then "saved" or "error". Overlapping saves resolve in order —
 * only the latest one decides the shown status.
 */
export function useSaveStatus(): { status: SaveStatus; track: <T>(save: Promise<T>) => Promise<T>; reset: () => void } {
    const [ status, setStatus ] = useState<SaveStatus>("idle");
    const latest = useRef(0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const track = useCallback(<T,>(save: Promise<T>): Promise<T> => {
        const ticket = ++latest.current;
        setStatus("saving");
        save.then(
            () => {
                if (mounted.current && ticket === latest.current) setStatus("saved");
            },
            () => {
                if (mounted.current && ticket === latest.current) setStatus("error");
            },
        );
        return save;
    }, []);

    // Safe to call during render (e.g. when a reused dialog reopens).
    const reset = useCallback(() => setStatus("idle"), []);

    return { status, track, reset };
}

const LABELS: Record<Exclude<SaveStatus, "idle">, string> = {
    saving: "שומר…",
    saved: "נשמר",
    error: "השמירה נכשלה",
};

/** A small live status next to a dialog title: שומר… → נשמר ✓, or an error. */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
    return (
        <Stack
            alignItems="center"
            aria-live="polite"
            data-testid="save-status"
            direction="row"
            gap={0.5}
            role="status"
            sx={ { minHeight: 20, color: status === "error" ? "error.main" : "text.secondary" } }
        >
            { status === "saving" ? <CircularProgress color="inherit" size={ 12 } /> : null }
            { status === "saved" ? <CheckIcon color="success" sx={ { fontSize: 16 } } /> : null }
            { status === "error" ? <ErrorOutlineIcon sx={ { fontSize: 16 } } /> : null }
            { status === "idle" ? null : <Typography variant="caption">{ LABELS[status] }</Typography> }
        </Stack>
    );
}
