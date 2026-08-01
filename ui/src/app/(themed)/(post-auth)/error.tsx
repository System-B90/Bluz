"use client";
import { useEffect } from "react";

import { ErrorSurface } from "@/components/errors/ErrorSurface";

/**
 * Segment-level error page for every authenticated route. Covers server
 * component throws and render-phase throws that escape the finer-grained
 * `ErrorBoundary`s around the calendar and gantt.
 */
export default function PostAuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[post-auth error boundary]", error);
    }, [error]);

    return (
        <ErrorSurface
            actions={[
                { label: "נסו שוב", onClick: () => reset(), variant: "contained" },
                { label: "חזרה ללוח הזמנים", href: "/" },
            ]}
            description="לא הצלחנו להציג את הדף הזה. אפשר לנסות לטעון אותו מחדש, או לחזור ללוח הזמנים."
            details={error.digest ?? error.message}
            title="משהו השתבש"
        />
    );
}
