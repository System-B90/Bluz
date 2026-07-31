export const dynamic = "force-dynamic";

import assert from "assert";

import { NextRequest, NextResponse } from "next/server";

import { ClientApiError, ForbiddenError, UserNotLoggedInError } from "@/api-shared/errors";
import { CACHE_CONTROL_HTTP_HEADER, IMMUTABLE_CACHE_MAX_TTL } from "@/settings";

export type ApiResponseHeaders = Record<string, string>;
export type ApiResponseInit =
    | (Omit<ResponseInit, "headers" | "status"> & {
          headers: ApiResponseHeaders;
      })
    | undefined;
/**
 * The object form is explicit, for responses that must not land in a shared
 * cache. Every API route sits behind Hive SSO, so anything user- or
 * tenant-visible has to be `private` — a proxy holding a `public` copy would
 * serve it on.
 */
export type ApiCacheControl =
    | "immutable"
    | "must-revalidate"
    | "no-cache"
    | "no-store"
    | { immutable?: boolean; maxAge: number; scope: "private" | "public" }
    | number;
export function ApiResponseMaker<T>(
    data: T,
    cacheControl?: ApiCacheControl,
    init?: ApiResponseInit,
) {
    const additionalHeaders: ApiResponseHeaders = {};
    if (cacheControl !== undefined) {
        assert(
            !init ||
                !init.headers ||
                !(CACHE_CONTROL_HTTP_HEADER in init.headers),
        );
        if (typeof cacheControl === "string") {
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                `public, ${cacheControl}`;
            if (cacheControl === "immutable") {
                additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                    `public, max-age=${IMMUTABLE_CACHE_MAX_TTL}, immutable`;
            } else if (cacheControl === "must-revalidate") {
                additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                    `public, max-age=1, must-revalidate`;
            }
        } else if (typeof cacheControl === "number") {
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                `public, max-age=${cacheControl}, immutable`;
        } else {
            const immutable = cacheControl.immutable === false ? "" : ", immutable";
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                `${cacheControl.scope}, max-age=${cacheControl.maxAge}${immutable}`;
        }
    }

    if (init === undefined) {
        init = { headers: additionalHeaders };
    } else if (init !== undefined && init.headers) {
        init.headers = { ...init.headers, ...additionalHeaders };
    }

    return new NextResponse<{ status: number; data: T }>(
        JSON.stringify({ status: 0, data: data }),
        {
            status: 200,
            ...init,
        },
    );
}
type ApiErrorPayload = { name: string; message: string; status?: unknown };

function hasStatus(e: object): e is { status: unknown } {
    return "status" in e;
}

export function ApiErrorMaker(
    e: unknown,
    httpStatus = 400,
): NextResponse<{ status: number; error: ApiErrorPayload | unknown }> {
    let errorPayload: ApiErrorPayload | unknown = {};
    if (e instanceof Error) {
        errorPayload = {
            name: e.name,
            message: e.message,
            status: hasStatus(e) ? e.status : undefined,
        };
    } else if (typeof e === "string") {
        errorPayload = {
            name: "Error",
            message: e,
        };
    } else {
        errorPayload = e;
    }
    return new NextResponse(
        JSON.stringify({ status: -1, error: errorPayload }),
        { status: httpStatus },
    );
}

export function ApiError(e: unknown) {
    return ApiErrorMaker(e, 500);
}

export function ApiAccessError(e: unknown) {
    return ApiErrorMaker(e, 403);
}

export function ApiSuccess<T>(
    data?: T,
    cacheControl?: ApiCacheControl,
    init?: ApiResponseInit,
) {
    return ApiResponseMaker(data, cacheControl, init);
}

/**
 * Detects a raw database driver error (postgres.js `PostgresError`, identified
 * by its `name` or a 5-char SQLSTATE `code`). These carry internal details —
 * table/column/constraint names, the offending SQL — that must never reach the
 * client (#162), so they are collapsed into an opaque 500 by {@link catchHandler}
 * rather than surfaced verbatim.
 */
export function isDatabaseError(e: unknown): boolean {
    if (!e || typeof e !== "object") return false;
    const err = e as { name?: unknown; code?: unknown; severity?: unknown };
    if (err.name === "PostgresError") return true;
    return (
        typeof err.code === "string" &&
        /^[0-9A-Z]{5}$/.test(err.code) &&
        typeof err.severity === "string"
    );
}

export function catchHandler<T extends NextRequest>(request: T, e: unknown) {
    if (e instanceof UserNotLoggedInError) {
        return NextResponse.json(
            { status: -1, error: { name: "UserNotLoggedInError", message: "אינך מחובר" } },
            { status: 401 },
        );
    }

    if (e instanceof ForbiddenError) {
        return NextResponse.json(
            { status: -1, error: { name: "ForbiddenError", message: "אין הרשאה לפעולה זו" } },
            { status: 403 },
        );
    }

    if (e instanceof ClientApiError) {
        return ApiErrorMaker(e, 400);
    }

    // Raw DB errors are logged server-side but returned as an opaque 500 so no
    // internal schema/constraint details leak to the client (#162).
    if (isDatabaseError(e)) {
        console.error("catchHandler database error", e);
        return ApiErrorMaker(
            { name: "InternalDatabaseError", message: "Internal Database Error" },
            500,
        );
    }

    console.error("catchHandler unexpected error", e);
    return ApiErrorMaker(
        { name: "InternalServerError", message: "שגיאה פנימית בשרת" },
        500,
    );
}

/**
 * Wrap a route handler with the standard error boundary. Thrown
 * `UserNotLoggedInError` / `ClientApiError` / unexpected errors map to
 * 401 / 400 / 500 via {@link catchHandler}, so handlers contain only the
 * happy path and `throw` for everything else.
 *
 * @example
 * ```ts
 * export const GET = withApi(async (request) => {
 *     return ApiSuccess(await DbThing.list());
 * });
 * ```
 */
export function withApi<TRequest extends Request, TContext = any>(
    handler: (request: TRequest, context: TContext) => Promise<Response>,
): (request: TRequest, context?: TContext) => Promise<Response> {
    return async (request: TRequest, context?: TContext) => {
        try {
            return await handler(request, context as TContext);
        } catch (e) {
            return catchHandler(request as never, e);
        }
    };
}

export type ServerApiRequest<T> = Omit<NextRequest, "json"> & {
    json: () => Promise<T>;
};
export type ServerApi<PayloadT, ResponseT> = (
    request: ServerApiRequest<PayloadT>,
) => Promise<NextResponse<ResponseT> | Response>;
export type ServerApiWithParams<PayloadT, ResponseT, ParamsT> = (
    request: ServerApiRequest<PayloadT>,
    context: { params: Promise<ParamsT> },
) => Promise<NextResponse<ResponseT> | Response>;
