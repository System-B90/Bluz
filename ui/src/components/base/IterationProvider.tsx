"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { apiListIterations } from "@/api-client/iterations";
import {
    ITERATION_QUERY_PARAM,
    Iteration,
    IterationId,
} from "@/api-shared/types/iteration";
import { useAuth } from "@/components/auth/AuthProvider";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type IterationScopeState = {
    /** Active iteration. `undefined` ⇒ the current (writable) run. */
    iterationId: IterationId | undefined;
    setIterationId: Dispatch<SetStateAction<IterationId | undefined>>;
    /** True while viewing a past iteration — every write route rejects it. */
    isReadOnlyIteration: boolean;
    /** All registered iterations, for pickers like `IterationSelector`. */
    iterations: Array<Iteration>;
    /** Id of the current (writable) run, once `iterations` has loaded. */
    currentIterationId: IterationId | undefined;
};

const IterationContext = createContext<IterationScopeState | undefined>(
    undefined,
);

/**
 * Owns the iteration the whole app is scoped to. This state used to live in
 * `CalendarProvider`, but everything backed by the iteration's database —
 * settings included — has to read it, and those providers mount above the
 * calendar. It therefore sits at the top of the post-auth tree instead.
 *
 * Mirrored to a `?it=` URL param (`ITERATION_QUERY_PARAM`) so a refresh or a
 * shared link keeps the selected iteration instead of silently falling back
 * to "current" (#456). Backfilled with the current iteration's id once known
 * if the param is missing, so the param is always present.
 */
export const IterationProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { enqueueSnackbar } = useSnackbar();
    const { addMessageHandler } = useAuth();

    const [iterationId, setIterationIdState] = useState<
        IterationId | undefined
    >(
        () =>
            (searchParams.get(ITERATION_QUERY_PARAM) as IterationId) ||
            undefined,
    );
    // Side-effect-free mirror of `iterationId`, read inside `setIterationId`
    // instead of a functional `setState` updater — React may invoke a
    // functional updater during render (bailout/replay), and `router.replace`
    // inside one leaked into IterationProvider's render phase (#crash).
    const iterationIdRef = useRef(iterationId);
    useEffect(() => {
        iterationIdRef.current = iterationId;
    }, [iterationId]);

    const [iterations, setIterations] = useState<Array<Iteration>>([]);
    const loadIterations = useCallback(() => {
        apiListIterations()
            .then(setIterations)
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
    }, [enqueueSnackbar]);
    useEffect(() => {
        loadIterations();
    }, [loadIterations]);

    const currentIterationId = iterations.find(
        (iteration) => iteration.isCurrent,
    )?.id;
    // Read inside the websocket handler, which must compare against whichever
    // iteration was current when the message arrived rather than the value
    // captured when the handler was built.
    const currentIterationIdRef = useRef(currentIterationId);
    // Whether the scope follows "the current run" rather than a pinned past
    // iteration. Tracked explicitly: inferring it from `currentIterationIdRef`
    // is racy, because that ref lags a switch until its refetch settles, and a
    // second switch inside that window used to look like a deliberate pin
    // (#667). Only an explicit pick of a non-current iteration clears it.
    const followingCurrentRef = useRef(!iterationId);
    useEffect(() => {
        currentIterationIdRef.current = currentIterationId;
        if (
            currentIterationId &&
            iterationIdRef.current === currentIterationId
        ) {
            followingCurrentRef.current = true;
        }
    }, [currentIterationId]);

    // Reacts to back/forward navigation and links carrying a different param.
    const paramValue = searchParams.get(ITERATION_QUERY_PARAM) || undefined;
    const lastAppliedParam = useRef(paramValue);
    useEffect(() => {
        if (paramValue === lastAppliedParam.current) return;
        lastAppliedParam.current = paramValue;
        followingCurrentRef.current =
            !paramValue || paramValue === currentIterationIdRef.current;
        setIterationIdState((paramValue as IterationId) || undefined);
    }, [paramValue]);

    const applyIterationId = useCallback(
        (next: IterationId | undefined) => {
            iterationIdRef.current = next;

            const params = new URLSearchParams(window.location.search);
            if (next) {
                params.set(ITERATION_QUERY_PARAM, next);
            } else {
                params.delete(ITERATION_QUERY_PARAM);
            }
            lastAppliedParam.current = next;
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, {
                scroll: false,
            });

            setIterationIdState(next);
        },
        [pathname, router],
    );

    const setIterationId: Dispatch<SetStateAction<IterationId | undefined>> =
        useCallback(
            (value) => {
                const next =
                    typeof value === "function"
                        ? value(iterationIdRef.current)
                        : value;
                followingCurrentRef.current =
                    !next || next === currentIterationIdRef.current;
                applyIterationId(next);
            },
            [applyIterationId],
        );

    // The current iteration changed (here or in another session). Two things
    // have to happen, or the whole tree keeps working against the iteration
    // that was current at mount time (#663): the list has to be refetched,
    // since `currentIterationId` is what decides read-only mode, and a scope
    // that was following "the current run" has to follow the switch instead of
    // silently becoming a read-only view of the demoted iteration. A scope
    // deliberately pointed at some *other* past iteration is left alone.
    const [switchNotice, setSwitchNotice] = useState<null | SwitchNotice>(
        null,
    );
    const onIterationChanged: MessageHandlerType = useCallback(
        (messageType: MessageTypes, data: unknown) => {
            if (messageType !== MessageTypes.CURRENT_ITERATION_CHANGED) return;
            loadIterations();
            const nextId = (data as { iterationId?: string } | null)
                ?.iterationId;
            if (!nextId) return;
            const scoped = iterationIdRef.current;
            const pinned = Boolean(scoped) && !followingCurrentRef.current;
            // The session that made the switch already got its own snackbar.
            if (localSwitchId === nextId) localSwitchId = undefined;
            else setSwitchNotice({ iterationId: nextId as IterationId, pinned });
            if (nextId === scoped || pinned) return;
            followingCurrentRef.current = true;
            applyIterationId(nextId as IterationId);
        },
        [loadIterations, applyIterationId],
    );
    useEffect(() => {
        if (typeof window === "undefined") return;
        return addMessageHandler(onIterationChanged);
    }, [addMessageHandler, onIterationChanged]);

    // Backfills a missing `?it=` param with the current iteration once the
    // list has loaded, so the URL always names an iteration explicitly (never
    // relies on server-side "no param ⇒ current" fallback for its own sake).
    useEffect(() => {
        if (iterationId || !currentIterationId) return;
        setIterationId(currentIterationId);
    }, [iterationId, currentIterationId, setIterationId]);

    const value = useMemo(
        () => ({
            iterationId,
            // Read-only only when scoped to a *past* iteration — an id that
            // happens to match the current run (shared link, refresh, browser
            // back) must not trip this, so compare against the fetched
            // current id rather than just checking the param is set (#456).
            isReadOnlyIteration: Boolean(
                iterationId && iterationId !== currentIterationId,
            ),
            setIterationId,
            iterations,
            currentIterationId,
        }),
        [iterationId, setIterationId, iterations, currentIterationId],
    );

    const noticeLabel = switchNotice
        ? (iterations.find(({ id }) => id === switchNotice.iterationId)
            ?.label ?? switchNotice.iterationId)
        : "";
    const closeNotice = () => setSwitchNotice(null);

    return (
        <IterationContext.Provider value={value}>
            {children}
            {/* A following scope's database changed under it: blocking, so it
                cannot be lost to a snackbar timeout mid-edit (#666). */}
            <Dialog
                aria-labelledby="iteration-switch-notice-title"
                open={Boolean(switchNotice && !switchNotice.pinned)}
            >
                <DialogTitle id="iteration-switch-notice-title">
                    המחזור הפעיל הוחלף
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {`"${noticeLabel}" הוגדר כמחזור הפעיל, והמערכת עברה אליו. עבודה שלא נשמרה במחזור הקודם אינה בטוחה — סגרו חלונות עריכה פתוחים ובדקו את השינויים מחדש.`}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button autoFocus onClick={closeNotice} variant="contained">
                        הבנתי
                    </Button>
                </DialogActions>
            </Dialog>
            {/* A pinned read-only scope keeps its data; a lighter, still
                non-expiring notice is enough. */}
            <Snackbar
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                open={Boolean(switchNotice?.pinned)}
            >
                <Alert onClose={closeNotice} severity="info">
                    {`"${noticeLabel}" הוגדר כמחזור הפעיל. התצוגה נשארת במחזור שנבחר.`}
                </Alert>
            </Snackbar>
        </IterationContext.Provider>
    );
};

type SwitchNotice = { iterationId: IterationId; pinned: boolean };

// Id of a switch this tab itself requested, so its own broadcast echo does
// not notify the actor twice. Module-level: one per browser tab, which is the
// unit that made the request.
let localSwitchId: string | undefined;

/** Call before requesting a current-iteration switch from this tab. */
export const noteLocalIterationSwitch = (iterationId: string) => {
    localSwitchId = iterationId;
};

export const useIterationScope = () => {
    const context = useContext(IterationContext);
    if (context === undefined) {
        throw new Error(
            "useIterationScope must be used within an IterationProvider",
        );
    }
    return context;
};

/**
 * The Hive instance backing the currently viewed iteration — each iteration
 * runs against its own Hive, so a hard-coded/env-default base URL would link
 * a past iteration's data into the wrong instance.
 */
export const useActiveIterationHiveUrl = (): string | undefined => {
    const { iterationId, currentIterationId, iterations } = useIterationScope();
    return useMemo(() => {
        const resolvedId = iterationId ?? currentIterationId;
        return iterations.find((it) => it.id === resolvedId)?.hiveUrl;
    }, [iterationId, currentIterationId, iterations]);
};
