"use client";
import React from "react";

export type ErrorBoundaryFallback =
    | ((error: Error, reset: () => void) => React.ReactNode)
    | React.ReactNode;

export type ErrorBoundaryProps = {
    children: React.ReactNode;
    fallback: ErrorBoundaryFallback;
    /** Label used in the console log so a crash can be traced to its subtree. */
    scope?: string;
};

type ErrorBoundaryState = { error: Error | null };

/**
 * React render-phase errors escape the notistack path entirely: a throw
 * unmounts the tree holding `SnackbarProvider`, so nothing is left to show a
 * toast. This is the only mechanism that contains such a throw, so it is
 * placed around each independently-failing subtree (a single event tile, the
 * calendar, the gantt) rather than once at the root.
 *
 * Next.js `error.tsx` covers the same class of failure but only at segment
 * granularity — it replaces the whole page.
 */
export class ErrorBoundary extends React.Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    public state: ErrorBoundaryState = { error: null };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    public componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(
            `[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ""}]`,
            error,
            info.componentStack,
        );
    }

    private readonly reset = () => this.setState({ error: null });

    public render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        const { fallback } = this.props;
        return typeof fallback === "function"
            ? fallback(error, this.reset)
            : fallback;
    }
}
