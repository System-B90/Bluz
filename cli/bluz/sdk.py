"""
Name: sdk.py
Purpose: `Bluz` — the scripting entry point. One object holds the HTTP session
         and exposes every API namespace as an attribute, so tab completion on
         `bz.` is the table of contents.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from collections.abc import Callable
from functools import partial
from typing import Any, Self

from bluz.api._base import ref
from bluz.api.calendar import DraftsAPI, EventsAPI, SnapshotsAPI
from bluz.api.directory import (
    ColorsAPI,
    CoursesAPI,
    OutsidersAPI,
    ReservationsAPI,
    RoomsAPI,
)
from bluz.api.gantt import GanttAPI
from bluz.api.iterations import IterationsAPI
from bluz.api.platform import (
    AiAPI,
    GoogleCalendarAPI,
    HiveAPI,
    PersonalSettingsAPI,
    SettingsAPI,
    StudentViewAPI,
    SystemAPI,
)
from bluz.client import BluzClient
from bluz.config import Config, load_config
from bluz.errors import ConfigError, NotAuthenticatedError
from bluz.help import describe
from bluz.models.iterations import Iteration
from bluz.models.misc import SessionInfo

__all__ = ["Bluz", "connect"]


class _class_or_instance:
    """Method that binds to the instance when called on one, else to the class."""

    def __init__(self, func: Callable[..., Bluz]) -> None:
        self._func = func
        self.__doc__ = func.__doc__
        self.__name__ = func.__name__

    def __get__(self, obj: Bluz | None, owner: type[Bluz]) -> Callable[..., Bluz]:
        return partial(self._func, owner if obj is None else obj)


class Bluz:
    """A session against one Bluz server.

    Credentials resolve like the CLI's: explicit arguments, then `BLUZ_URL` /
    `BLUZ_TOKEN` / `BLUZ_INSECURE` (a local `.env` is honoured), then the file
    `bluz login` writes. So after `bluz login`, `Bluz()` just works.

    Namespaces:
        iterations, courses, rooms, outsiders, colors, reservations,
        events, drafts, snapshots, gantt (curriculums/syllabuses/modules/
        events/weeks/days), settings, personal, google, hive, ai,
        student_view, system.

    Examples:
        >>> from bluz import Bluz
        >>> with Bluz() as bz:
        ...     cur = bz.gantt.curriculums["Bis90 2026"]
        ...     for syllabus in cur:
        ...         print(syllabus.title, sum(e.minimum_duration for e in syllabus.events))

    Args:
        url: Server base URL, e.g. "https://bluz.example".
        token: next-auth session token.
        insecure: Skip TLS verification (self-signed certificates).
        timeout: Per-request timeout, seconds.
        iteration: Default iteration for iteration-aware calls (None = current).
    """

    def __init__(
        self,
        url: str | None = None,
        token: str | None = None,
        *,
        insecure: bool | None = None,
        timeout: float = 30.0,
        iteration: str | Iteration | None = None,
        http: BluzClient | None = None,
    ) -> None:
        self.config: Config = (
            http.config
            if http is not None
            else load_config(url=url, token=token, insecure=insecure)
        )
        self._timeout = timeout
        self._http = http
        self._owns_http = http is None
        self.iteration: str | None = ref(iteration) if iteration is not None else None

        self.iterations = IterationsAPI(self)
        self.courses = CoursesAPI(self)
        self.rooms = RoomsAPI(self)
        self.outsiders = OutsidersAPI(self)
        self.colors = ColorsAPI(self)
        self.reservations = ReservationsAPI(self)
        self.events = EventsAPI(self)
        self.drafts = DraftsAPI(self)
        self.snapshots = SnapshotsAPI(self)
        self.gantt = GanttAPI(self)
        self.settings = SettingsAPI(self)
        self.personal = PersonalSettingsAPI(self)
        self.google = GoogleCalendarAPI(self)
        self.hive = HiveAPI(self)
        self.ai = AiAPI(self)
        self.student_view = StudentViewAPI(self)
        self.system = SystemAPI(self)

    @classmethod
    def from_client(cls, http: BluzClient, *, iteration: str | None = None) -> Self:
        """Wrap an existing low-level `BluzClient` (it is not closed by this session)."""
        return cls(http=http, iteration=iteration)

    # --- signing in ------------------------------------------------------------

    @_class_or_instance
    def login(
        self_or_cls: type[Bluz] | Bluz,
        url: str | None = None,
        *,
        insecure: bool | None = None,
        save: bool = True,
        timeout: float = 30.0,
    ) -> Bluz:
        """Sign in through the browser and return a ready session.

        The same handoff flow as `bluz login`: a browser tab opens on the Bluz
        login page and hands the session back automatically. If it cannot
        (no browser, blocked loopback), paste the handoff code the tab shows
        when prompted. With `save=True` the result is written to the user
        config file, so later `Bluz()` calls — and the CLI — reuse it.

        Called on a session (`bz.login()`) it signs in to *that session's*
        server and refreshes the session in place. Called on the class
        (`Bluz.login(url)`) it returns a new session.

        Examples:
            >>> bz = Bluz.login("https://bluz.example")
            >>> bz.login()  # token expired: sign in again, same server
            >>> bz.whoami().user
        """
        from getpass import getpass

        from bluz.commands.auth import browser_login, redeem_handoff_code

        instance = self_or_cls if isinstance(self_or_cls, Bluz) else None
        existing = instance.config if instance is not None else load_config()
        target = (url or existing.url or "").rstrip("/")
        if not target:
            raise ConfigError(
                "Pass the server URL: Bluz.login('https://bluz.example')."
            )
        verify_off = existing.insecure if insecure is None else insecure

        token = browser_login(target, insecure=verify_off)
        if not token:
            code = getpass("Handoff code shown in the browser tab: ").strip()
            if not code:
                raise NotAuthenticatedError("Login cancelled — no handoff code.")
            token = redeem_handoff_code(target, code, insecure=verify_off)

        if save:
            Config(url=target, token=token, insecure=verify_off).save()
        if instance is None:
            return Bluz(target, token, insecure=verify_off, timeout=timeout)
        instance.config = Config(url=target, token=token, insecure=verify_off)
        instance._timeout = timeout
        if instance._http is not None and instance._owns_http:
            instance._http.close()
        instance._http = None
        instance._owns_http = True
        return instance

    def whoami(self) -> SessionInfo:
        """Who this session's token belongs to, and when it expires.

        Returns an empty `SessionInfo` (`.authenticated is False`) instead of
        raising when the token is missing or expired.
        """
        try:
            data = self.http.get_raw("/api/auth/session")
        except NotAuthenticatedError:
            data = {}
        return SessionInfo.from_wire(data or {}, self)

    @property
    def is_authenticated(self) -> bool:
        """True when the server accepts this session's token (one request)."""
        return self.whoami().authenticated

    def require_login(self) -> SessionInfo:
        """Fail fast with a clear message unless the token is valid.

        Call it at the top of a script so an expired session stops the run
        before the first write, not halfway through.
        """
        info = self.whoami()
        if not info.authenticated:
            raise NotAuthenticatedError(
                f"Not signed in to {self.url}. Run `bluz login` or "
                "`Bluz.login(url)`, or set BLUZ_TOKEN."
            )
        return info

    def help(self) -> None:
        """Print every namespace and its methods, one line each."""
        print(describe(self))

    # --- plumbing ---------------------------------------------------------------

    @property
    def http(self) -> BluzClient:
        """The low-level client (`.get/.post/...` on raw `/api/*` paths) — the
        escape hatch for anything without a method yet. Opened on first use."""
        if self._http is None:
            self._http = BluzClient(self.config, timeout=self._timeout)
        return self._http

    @property
    def url(self) -> str | None:
        """The server base URL this session talks to."""
        return self.config.url

    def scoped(self, iteration: str | Iteration | None) -> Bluz:
        """A sibling session whose iteration-aware calls default to `iteration`.

        Shares this session's connection.

        Examples:
            >>> past = bz.scoped("2026a")
            >>> past.courses.list()
        """
        sibling = Bluz.__new__(Bluz)
        sibling.__dict__.update(self.__dict__)
        sibling._owns_http = False
        sibling.iteration = ref(iteration) if iteration is not None else None
        for name, value in list(self.__dict__.items()):
            if hasattr(value, "_bluz"):
                setattr(sibling, name, type(value)(sibling))
        sibling.gantt = GanttAPI(sibling)
        sibling._http = self.http
        return sibling

    def close(self) -> None:
        """Close the HTTP connection (a no-op for sessions sharing another's)."""
        if self._http is not None and self._owns_http:
            self._http.close()
            self._http = None

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def __repr__(self) -> str:
        scope = self.iteration or "current"
        return f"<Bluz {self.url or '(no url)'} iteration={scope}>"

    def _repr_pretty_(self, printer: Any, cycle: bool) -> None:
        printer.text(repr(self))


def connect(
    url: str | None = None,
    token: str | None = None,
    **kwargs: Any,
) -> Bluz:
    """Open a `Bluz` session — same as `Bluz(url, token, **kwargs)`."""
    return Bluz(url, token, **kwargs)
