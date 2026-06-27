"""
Name: client.py
Purpose: Thin HTTP client that speaks the Bluz API envelope ({ status, data, error })
         and centralises auth, base-URL joining, and error translation.
Created: 2026-06-27
Author: Michael K. Steinberg
"""

from __future__ import annotations

from typing import Any

import httpx

from bluz_cli.config import Config
from bluz_cli.errors import BluzApiError, NotAuthenticatedError

# `safeApiFetcher` (ui/src/api-client/common.tsx) treats a redirect as "the user is
# not logged in" — we mirror that here instead of silently following it to an HTML
# login page.
_DEFAULT_TIMEOUT = 30.0


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
        return self.request("GET", path, params=params)

    def post(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("POST", path, json=json, params=params)

    def put(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("PUT", path, json=json, params=params)

    def patch(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("PATCH", path, json=json, params=params)

    def delete(self, path: str, *, json: Any = None, params: dict | None = None) -> Any:
        return self.request("DELETE", path, json=json, params=params)

    # --- core ---------------------------------------------------------------

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """
        Issue a request and unwrap the Bluz response envelope.

        Returns the `data` field on success; raises `BluzApiError` /
        `NotAuthenticatedError` on failure.
        """
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        try:
            response = self._client.request(
                method, path, json=json, params=clean_params
            )
        except httpx.RequestError as exc:
            raise BluzApiError("NetworkError", str(exc)) from exc

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
