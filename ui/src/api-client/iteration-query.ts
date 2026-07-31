import {
    ITERATION_QUERY_PARAM,
    IterationId,
} from "@/api-shared/types/iteration";

/**
 * Append the active iteration to a request, when one is selected. An absent id
 * means the current (writable) run, which every route treats as the default.
 */
export function withIteration(endpoint: URL, iterationId?: IterationId): URL {
    if (iterationId) {
        endpoint.searchParams.set(ITERATION_QUERY_PARAM, iterationId);
    }
    return endpoint;
}

/** Same, for call sites that pass a relative path rather than a `URL`. */
export function iterationEndpoint(
    path: string,
    iterationId?: IterationId,
): string {
    if (!iterationId) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}${ITERATION_QUERY_PARAM}=${encodeURIComponent(
        iterationId,
    )}`;
}
