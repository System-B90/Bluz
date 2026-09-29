import { RefObject, useEffect, useRef } from "react";

/**
 * Scroll the container to a row whose id newly joined `ids` (a created or
 * duplicated entry). Rows are found by their DOM `id`, built by `anchorId`.
 * The first render only records the ids, so opening a list never scrolls.
 */
export function useScrollToNewRow<T extends string>(
    ids: ReadonlyArray<T>,
    containerRef: RefObject<HTMLElement | null>,
    anchorId: (id: T) => string,
) {
    const seenRef = useRef<null | ReadonlySet<T>>(null);

    useEffect(() => {
        const seen = seenRef.current;
        seenRef.current = new Set(ids);
        if (!seen) return;

        const added = ids.find((id) => !seen.has(id));
        if (!added) return;

        const frameId = window.requestAnimationFrame(() => {
            containerRef.current
                ?.querySelector(`[id=${JSON.stringify(anchorId(added))}]`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [ids, containerRef, anchorId]);
}
