"""
Name: client.py
Purpose: Thin HTTP client that speaks the Bluz API envelope ({ status, data, error })
         and centralises auth, base-URL joining, and error translation.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from bluz_cli.config import Config
from bluz_cli.errors import BluzApiError, NotAuthenticatedError

# `safeApiFetcher` (ui/src/api-client/common.ts) treats a redirect as "the user is
# not logged in" — we mirror that here instead of silently following it to an HTML
# login page.
_DEFAULT_TIMEOUT = 30.0

# GET is idempotent, so a transient network error (a dropped connection, a
# reset during a slow cut/export) is worth one bounded retry before surfacing
# a bare NetworkError. Writes (POST/PUT/PATCH/DELETE) are never retried here —
# retrying a write whose response was merely lost could double it up.
_GET_RETRY_ATTEMPTS = 3
_GET_RETRY_BACKOFF_SECONDS = 0.5

# Terminator every OpenAI-compatible backend sends after the last SSE chunk;
# mirrors SSE_DONE_SENTINEL in ui/src/api-shared/sse.ts.
_SSE_DONE_SENTINEL = "[DONE]"


class BluzClient:
    """Authenticated HTTP client for the Bluz `/api/*` surface."""

    def __init__(self, config: Config, *, timeout: float = _DEFAULT_TIMEOUT) -> None:
        self._config = config
        base_url = config.require_url()

        cookies: dict[str, str] = {}
        headers = {"Accept": "application/json"}
        if config.token:
            # next-auth session cookie — the same credential the browser sends.
            cookies[config.cookie_name] = config.token

        self._client = httpx.Client(
            base_url=base_url,
            cookies=cookies,
            headers=headers,
            timeout=timeout,
            follow_redirects=False,
            verify=not config.insecure,
        )

    def __enter__(self) -> "BluzClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    # --- verb helpers -------------------------------------------------------

    def get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        return self.request("GET", path, params=params, retries=_GET_RETRY_ATTEMPTS)

    def post(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("POST", path, json=json, params=params)

    def put(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("PUT", path, json=json, params=params)

    def patch(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("PATCH", path, json=json, params=params)

    def delete(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("DELETE", path, json=json, params=params)

    def get_raw(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        """GET a route that does **not** speak the Bluz response envelope.

        `/api/health` is the case this exists for. It answers a bare
        `{ status: "healthy" | "degraded" | "unhealthy", checks: {...} }`,
        which collides head-on with the envelope convention: `_unwrap` sees a
        dict carrying a "status" key, finds it is not the success sentinel `0`,
        and raises — so the report can never be read through `get`. It also
        answers 503 when unhealthy, which is a real answer here, not a failure
        to report.
        """
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        try:
            response = self._client.request("GET", path, params=clean_params)
        except httpx.RequestError as exc:
            raise BluzApiError("NetworkError", str(exc)) from exc

        if response.is_redirect or response.status_code == 401:
            raise NotAuthenticatedError()

        try:
            return response.json()
        except ValueError as exc:
            raise BluzApiError(
                "InvalidResponse", f"Server did not return valid JSON: {exc}"
            ) from exc

    def stream_sse(self, path: str, *, json: Any = None):
        """POST a request whose body is a Server-Sent Events stream, yielding
        each `data:` frame already parsed from JSON.

        `/api/ai/chat` is the case this exists for: it is the one route that
        answers a stream instead of the response envelope, so an error raised
        after the first byte arrives as a terminal frame rather than as an HTTP
        status. Frames that are not JSON (a keep-alive comment slipping through,
        a truncated tail) are skipped rather than crashing a turn mid-answer.
        """
        import json as json_module

        try:
            with self._client.stream("POST", path, json=json) as response:
                if response.is_redirect or response.status_code == 401:
                    raise NotAuthenticatedError()
                if response.is_error:
                    response.read()
                    raise self._error_from_body(response)
                for line in response.iter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if payload == _SSE_DONE_SENTINEL:
                        return
                    try:
                        yield json_module.loads(payload)
                    except ValueError:
                        continue
        except httpx.RequestError as exc:
            raise BluzApiError("NetworkError", str(exc)) from exc

    @staticmethod
    def _error_from_body(response: httpx.Response) -> BluzApiError:
        """Translate an errored response body into a BluzApiError."""
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            error = body.get("error")
            if isinstance(error, dict):
                return BluzApiError(
                    error.get("name", "Error"),
                    error.get("message", ""),
                    response.status_code,
                )
        return BluzApiError(
            "HttpError",
            (response.text or response.reason_phrase)[:500],
            response.status_code,
        )

    # --- core ---------------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: dict[str, Any] | None = None,
        retries: int = 1,
    ) -> Any:
        """
        Issue a request and unwrap the Bluz response envelope.

        Returns the `data` field on success; raises `BluzApiError` /
        `NotAuthenticatedError` on failure. `retries` bounds how many times a
        transient network error is retried (GET only — see `_GET_RETRY_ATTEMPTS`).
        """
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        attempts = max(1, retries)
        last_error: httpx.RequestError | None = None
        response = None
        for attempt in range(attempts):
            try:
                response = self._client.request(
                    method, path, json=json, params=clean_params
                )
                last_error = None
                break
            except httpx.RequestError as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    time.sleep(_GET_RETRY_BACKOFF_SECONDS * (attempt + 1))
        if last_error is not None:
            raise BluzApiError("NetworkError", str(last_error)) from last_error

        # A redirect on an API call means "log in" (see safeApiFetcher).
        if response.is_redirect:
            raise NotAuthenticatedError()
        if response.status_code == 401:
            raise NotAuthenticatedError()

        return self._unwrap(response)

    @staticmethod
    def _unwrap(response: httpx.Response) -> Any:
        import json

        content_type = response.headers.get("content-type", "")
        is_json = "application/json" in content_type
        body = None

        if not is_json:
            text = response.text.strip()
            if (text.startswith("{") and text.endswith("}")) or (
                text.startswith("[") and text.endswith("]")
            ):
                try:
                    body = json.loads(text)
                    is_json = True
                except ValueError:
                    pass

        if not is_json:
            # Non-JSON payloads (e.g. an Excel export) are returned verbatim.
            if response.is_error:
                raise BluzApiError(
                    "HttpError",
                    response.text[:500] or response.reason_phrase,
                    response.status_code,
                )
            return response.content

        if body is None:
            try:
                body = response.json()
            except ValueError as exc:
                raise BluzApiError(
                    "InvalidResponse", f"Server did not return valid JSON: {exc}"
                ) from exc

        if isinstance(body, dict) and "status" in body:
            if body.get("status") == 0:
                return body.get("data")
            error = body.get("error") or {}
            if isinstance(error, dict):
                raise BluzApiError(
                    error.get("name", "Error"),
                    error.get("message", ""),
                    response.status_code,
                )
            raise BluzApiError("Error", str(error), response.status_code)

        # Some endpoints may answer with a bare JSON value.
        if response.is_error:
            raise BluzApiError("HttpError", str(body)[:500], response.status_code)
        return body
