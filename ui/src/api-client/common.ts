import { ApiResponseJson } from "@/api-shared/common";
import {
    ClientApiError,
    constructErrorFromNetworkMessage,
    OperationAborted as OperationAbortedWarning,
    ServerNetworkError,
} from "@/api-shared/errors";

const API_LOGIN_REQUIRED_SLEEP_TIMEOUT = 60 * 1000; // 1 Minute

// No wrapper composed a timeout, and nothing bounded a stalled request — a
// dropped connection or a hung gateway left the caller's await pending
// forever. Every safeApiFetcher call now races against this ceiling unless
// the caller supplies its own longer-lived signal.
const DEFAULT_API_TIMEOUT_MS = 30 * 1000; // 30 Seconds

/**
 * Combines the caller's abort signal (if any) with a timeout signal, so every
 * request is bounded even when the caller doesn't pass one.
 *
 * `AbortSignal.any` fires on whichever signal aborts first, so a caller's own
 * long-lived signal cannot raise this ceiling — it can only lower it. An
 * endpoint that is legitimately slower than the default (a long-running agent
 * turn, say) therefore has to say so with `timeoutMs`, which is deliberately
 * explicit: the alternative is every such caller dropping the wrapper and
 * losing the redirect handling and envelope unwrapping with it.
 */
function withTimeout(
    signal: AbortSignal | null | undefined,
    timeoutMs: number = DEFAULT_API_TIMEOUT_MS,
) {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

/** Per-call overrides for {@link safeApiFetcher}. */
export type SafeApiFetcherOptions = {
    /**
     * Overrides the default request ceiling. Only raise it for an endpoint
     * whose work genuinely takes longer than {@link DEFAULT_API_TIMEOUT_MS};
     * it is not a way to paper over a slow route.
     */
    timeoutMs?: number;
};

async function safeFetcher(
    input: RequestInfo,
    init?: RequestInit | undefined,
): Promise<Response> {
    return await fetch(input, init);
}

export async function safeApiFetcher<T = unknown>(
    input: RequestInfo,
    init?: RequestInit | undefined,
    options?: SafeApiFetcherOptions,
): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    const mergedInit: RequestInit = {
        ...init,
        headers,
        signal: withTimeout(init?.signal, options?.timeoutMs),
    };
    return await safeFetcher(input, mergedInit)
        .then((response): Promise<any> => {
            // An API request should only return a redirect if the user is not logged in!
            if (response.redirected) {
                window.location.replace(response.url);
                return new Promise((r) =>
                    setTimeout(r, API_LOGIN_REQUIRED_SLEEP_TIMEOUT),
                );
            }

            const contentType = response.headers.get("content-type") ?? "";
            const isJson = contentType.includes("application/json");

            // A proxy/gateway failure (or an outright empty body) never
            // reaches our JSON envelope — branch on response.ok/content-type
            // before parsing, instead of letting a non-JSON body blow up
            // JSON.parse into an opaque ServerNetworkError with the real
            // HTTP status lost.
            if (!response.ok || !isJson) {
                if (!isJson) {
                    throw new ServerNetworkError(
                        `שגיאת שרת (${response.status} ${response.statusText})`,
                    );
                }
                return response.json().then((data: Partial<ApiResponseJson>) => {
                    throw constructErrorFromNetworkMessage({
                        ...(data.error as ClientApiError),
                        status: response.status,
                    } as unknown as ClientApiError);
                });
            }

            return response.json().then((data: ApiResponseJson) => {
                if (data.status === 0) {
                    return data.data;
                }

                throw constructErrorFromNetworkMessage({
                    ...(data.error as ClientApiError),
                    status: response.status,
                } as unknown as ClientApiError);
            });
        })
        .catch((e: unknown) => {
            if (e instanceof ClientApiError) {
                throw e;
            }
            if (e instanceof Error) {
                if (e.name === "AbortError" || e.name === "TimeoutError") {
                    throw new OperationAbortedWarning();
                }
            }
            // `JSON.stringify` on an Error yields "{}" — its properties are
            // non-enumerable — which hides the actual failure from the user.
            throw new ServerNetworkError(
                e instanceof Error ? e.message : String(e),
            );
        });
}

export type ClientApiProps = Omit<RequestInit, "body" | "method">;

export type ClientApi<PayloadT, ResponseT> = (
    payload: PayloadT,
    props?: ClientApiProps,
) => Promise<ResponseT>;
export type ClientApiNoPayload<ResponseT> = (
    props?: ClientApiProps,
) => Promise<ResponseT>;
