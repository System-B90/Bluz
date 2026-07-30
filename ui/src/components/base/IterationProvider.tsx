"use client";

import {
    createContext,
    Dispatch,
    SetStateAction,
    useContext,
    useMemo,
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

/**
 * Owns the iteration the whole app is scoped to. This state used to live in
 * `CalendarProvider`, but everything backed by the iteration's database —
 * settings included — has to read it, and those providers mount above the
 * calendar. It therefore sits at the top of the post-auth tree instead.
 */
export const IterationProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [iterationId, setIterationId] = useState<IterationId | undefined>(
        undefined,
    );

    const value = useMemo(
        () => ({
            iterationId,
            isReadOnlyIteration: Boolean(iterationId),
            setIterationId,
        }),
        [iterationId],
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
