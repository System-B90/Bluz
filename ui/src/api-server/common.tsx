export const dynamic = "force-dynamic";

import assert from "assert";

import { NextRequest, NextResponse } from "next/server";

import { ClientApiError, UserNotLoggedInError } from "@/api-shared/errors";
import { CACHE_CONTROL_HTTP_HEADER, IMMUTABLE_CACHE_MAX_TTL } from "@/settings";

export type ApiResponseHeaders = Record<string, string>;
export type ApiResponseInit =
  | (Omit<ResponseInit, "headers" | "status"> & { headers: ApiResponseHeaders })
  | undefined;
export type ApiCacheControl =
  | "immutable"
  | "must-revalidate"
  | "no-cache"
  | "no-store"
  | number;
export function ApiResponseMaker(
    data: any,
    cacheControl?: ApiCacheControl,
    init?: ApiResponseInit,
) {
    const additionalHeaders: ApiResponseHeaders = {};
    if (cacheControl !== undefined) {
        assert(
            !init || !init.headers || !(CACHE_CONTROL_HTTP_HEADER in init.headers),
        );
        if (typeof cacheControl === "string") {
            additionalHeaders[CACHE_CONTROL_HTTP_HEADER] = `public, ${cacheControl}`;
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
        }
    }

    if (init === undefined) {
        init = { headers: additionalHeaders };
    } else if (init !== undefined && init.headers) {
        init.headers = { ...init.headers, ...additionalHeaders };
    }

    return new NextResponse(JSON.stringify({ status: 0, data: data }), {
        status: 200,
        ...init,
    });
}
export function ApiErrorMaker(e: any) {
    let errorPayload: any = {};
    if (e instanceof Error) {
        errorPayload = {
            name: e.name,
            message: e.message,
            status: (e as any).status,
        };
    } else if (typeof e === "string") {
        errorPayload = {
            name: "Error",
            message: e,
        };
    } else {
        errorPayload = e;
    }
    return new NextResponse(JSON.stringify({ status: -1, error: errorPayload }), {
        status: 200,
    });
}

export function ApiError(e: any) {
    return ApiErrorMaker(e);
}

export function ApiAccessError(e: any) {
    return ApiErrorMaker(e);
}

export function ApiSuccess(
    data?: any,
    cacheControl?: ApiCacheControl,
    init?: ApiResponseInit,
) {
    return ApiResponseMaker(data, cacheControl, init);
}

export function catchHandler<T extends NextRequest>(request: T, e: any) {
    if (e instanceof UserNotLoggedInError) {
        return NextResponse.error();
    }

    if (e instanceof ClientApiError) {
        return ApiErrorMaker(e);
    }

    console.log("catchHandler", e);
    return ApiError(e);
}
