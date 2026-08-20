"use client";

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

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiListIterations } from "@/api-client/iterations";
import {
    ITERATION_QUERY_PARAM,
    Iteration,
    IterationId,
} from "@/api-shared/types/iteration";

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

    const [iterationId, setIterationIdState] = useState<
        IterationId | undefined
    >(() => (searchParams.get(ITERATION_QUERY_PARAM) as IterationId) || undefined);

    const [iterations, setIterations] = useState<Array<Iteration>>([]);
    useEffect(() => {
        let mounted = true;
        apiListIterations()
            .then((list) => {
                if (mounted) setIterations(list);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
        return () => {
            mounted = false;
        };
    }, [enqueueSnackbar]);
    const currentIterationId = iterations.find(
        (iteration) => iteration.isCurrent,
    )?.id;

    // Reacts to back/forward navigation and links carrying a different param.
    const paramValue = searchParams.get(ITERATION_QUERY_PARAM) || undefined;
    const lastAppliedParam = useRef(paramValue);
    useEffect(() => {
        if (paramValue === lastAppliedParam.current) return;
        lastAppliedParam.current = paramValue;
        setIterationIdState((paramValue as IterationId) || undefined);
    }, [paramValue]);

    const setIterationId: Dispatch<SetStateAction<IterationId | undefined>> =
        useCallback(
            (value) => {
                setIterationIdState((prev) => {
                    const next =
                        typeof value === "function" ? value(prev) : value;

                    const params = new URLSearchParams(
                        window.location.search,
                    );
                    if (next) {
                        params.set(ITERATION_QUERY_PARAM, next);
                    } else {
                        params.delete(ITERATION_QUERY_PARAM);
                    }
                    lastAppliedParam.current = next;
                    const query = params.toString();
                    router.replace(
                        query ? `${pathname}?${query}` : pathname,
                        { scroll: false },
                    );

                    return next;
                });
            },
            [pathname, router],
        );

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

    return (
        <IterationContext.Provider value={value}>
            {children}
        </IterationContext.Provider>
    );
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
