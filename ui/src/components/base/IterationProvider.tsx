"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

import { IterationId } from "@/api-shared/types/iteration";

export type IterationScopeState = {
    /** Active iteration. `undefined` ⇒ the current (writable) run. */
    iterationId: IterationId | undefined;
    setIterationId: Dispatch<SetStateAction<IterationId | undefined>>;
    /** True while viewing a past iteration — every write route rejects it. */
    isReadOnlyIteration: boolean;
};

const IterationContext = createContext<IterationScopeState | undefined>(
    undefined,
);

/** URL query param the active iteration is mirrored to (#456). */
const ITERATION_PARAM = "iteration";

/**
 * Owns the iteration the whole app is scoped to. This state used to live in
 * `CalendarProvider`, but everything backed by the iteration's database —
 * settings included — has to read it, and those providers mount above the
 * calendar. It therefore sits at the top of the post-auth tree instead.
 *
 * Mirrored to a `?iteration=` URL param so a refresh or a shared link keeps
 * the selected iteration instead of silently falling back to "current" (#456).
 */
export const IterationProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [iterationId, setIterationIdState] = useState<
        IterationId | undefined
    >(() => (searchParams.get(ITERATION_PARAM) as IterationId) || undefined);

    // Reacts to back/forward navigation and links carrying a different param.
    const paramValue = searchParams.get(ITERATION_PARAM) || undefined;
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
                        params.set(ITERATION_PARAM, next);
                    } else {
                        params.delete(ITERATION_PARAM);
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

    const value = useMemo(
        () => ({
            iterationId,
            isReadOnlyIteration: Boolean(iterationId),
            setIterationId,
        }),
        [iterationId, setIterationId],
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
