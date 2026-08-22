
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
/**
 * `JSON.parse` on a request body, with a malformed payload reported as the
 * 400 it is. Parsing straight through leaks a `SyntaxError` into the generic
 * error handler, which answers an opaque 500 for what is a caller mistake.
 */
export function parseJsonBody<T>(text: string): T {
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new ClientApiError("Malformed JSON payload.");
    }
}

/**
 * Copy only the listed fields off a client-supplied payload.
 *
 * Mongo creates used to persist the request body field-for-field, so a caller
 * could store arbitrary extra keys on a course/room/outsider/colour document -
 * including `_id`, which then fights the driver - and any field the app later
 * gives meaning to was retroactively client-writable (#538 item 4). Postgres
 * writes get this from `sanitizeCreatePayload`; this is the Mongo counterpart.
 *
 * Absent keys stay absent rather than becoming `undefined` values, so an
 * optional field is not stored as a null-ish key.
 */
export function pickFields<T extends object, K extends keyof T>(
    payload: T,
    fields: ReadonlyArray<K>,
): Pick<T, K> {
    const picked: Partial<Pick<T, K>> = {};
    for (const field of fields) {
        if (payload[field] !== undefined) {
            picked[field] = payload[field];
        }
    }
    return picked as Pick<T, K>;
}

/**
 * Read a request body that must be a JSON object, and reject anything else at
 * the boundary.
 *
 * Handlers used to cast `await request.json()` straight to a domain type with
 * `as`. That is a lie the type system cannot catch: a literal `null` body
 * survives a `typeof body === "object"` guard and crashes the first
 * destructuring, an array passes a truthiness check, and wrong-typed fields
 * travel all the way into Mongo/Postgres and come back as an opaque 500
 * instead of the 400 the caller earned (#522).
 *
 * The returned value is still cast — this validates the *shape*, not the
 * fields — so callers that care about individual fields must still check them.
 */
export async function requireJsonObjectBody<T>(request: Request): Promise<T> {
    const body = parseJsonBody<unknown>(await request.text());
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        throw new ClientApiError("Request body must be a JSON object.");
    }
    return body as T;
}

export function ApiResponseMaker<T>(
    data: T,
    cacheControl?: ApiCacheControl,
    init?: ApiResponseInit,
) {
    // `new NextResponse(string)` defaults to `text/plain`; the body here is
    // always JSON, so say so or clients are free to mis-sniff it.
    const additionalHeaders: ApiResponseHeaders = {
        "Content-Type": "application/json",
    };
    if (cacheControl !== undefined) {
        assert(
            !init ||
                !init.headers ||
                !(CACHE_CONTROL_HTTP_HEADER in init.headers),
        );
        if (typeof cacheControl === "string") {
            // Each shorthand maps to one explicit directive set. The previous
            // `public, ${cacheControl}` template produced the contradictions
            // `public, no-store` and `public, no-cache` (#538 item 10) — and
            // "public" is wrong for those two anyway: an uncacheable response
            // from behind SSO must not be marked shared-cacheable.
            const STRING_CACHE_CONTROL: Record<string, string> = {
                immutable: `public, max-age=${IMMUTABLE_CACHE_MAX_TTL}, immutable`,
                "must-revalidate": "public, max-age=1, must-revalidate",
                "no-cache": "private, no-cache",
                "no-store": "private, no-store",
            };
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                STRING_CACHE_CONTROL[cacheControl];
        } else if (typeof cacheControl === "number") {
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                `public, max-age=${cacheControl}, immutable`;
        } else {
            const immutable = cacheControl.immutable === false ? "" : ", immutable";
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] =
                `${cacheControl.scope}, max-age=${cacheControl.maxAge}${immutable}`;
        }
    }

    init =
        init === undefined
            ? { headers: additionalHeaders }
            : { ...init, headers: { ...init.headers, ...additionalHeaders } };

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
        {
            status: httpStatus,
            headers: { "Content-Type": "application/json" },
        },
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

/**
 * A Mongo unique-index violation (error code 11000). Unlike the opaque
 * database errors below this one is entirely the caller's doing — it means the
 * id they supplied already exists — so it maps to 409, not 500 (#514).
 */
export function isDuplicateKeyError(e: unknown): boolean {
    if (!e || typeof e !== "object") return false;
    return (e as { code?: unknown }).code === 11000;
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

    // `request.json()` on an empty or malformed body rejects with a
    // `SyntaxError`. That is a caller mistake, not a server fault, so it must
    // not fall through to the opaque 500 below (#465). Routes that parse the
    // body themselves get the same treatment via {@link parseJsonBody}.
    if (e instanceof SyntaxError) {
        return ApiErrorMaker(
            { name: "ClientApiError", message: "Malformed JSON payload." },
            400,
        );
    }

    if (isDuplicateKeyError(e)) {
        return ApiErrorMaker(
            { name: "ConflictError", message: "מזהה זה כבר קיים" },
            409,
        );
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
