"""
Name: login_and_session.py
Purpose: Every way to get a session — saved login, env vars, explicit token, browser login.
Created: 2026-10-02
Author: Michael K. Steinberg

Credentials resolve in this order: explicit arguments → BLUZ_URL / BLUZ_TOKEN /
BLUZ_INSECURE (a local .env counts) → the file `bluz login` writes.

    from bluz import Bluz

    bz = Bluz()                                   # whatever `bluz login` saved
    bz = Bluz("https://bluz.example", token)      # explicit
    bz = Bluz.login("https://bluz.example")       # browser sign-in, saved for next time
    with Bluz() as bz: ...                        # closes the connection on exit

Then check it before doing real work:

    bz.whoami()          # SessionInfo(user=SessionUser(name=..., email=...), expires=...)
    bz.require_login()   # raises NotAuthenticatedError with what to do next
"""

from __future__ import annotations

from datetime import UTC, datetime

from bluz import Bluz


def main(bz: Bluz) -> None:
    info = bz.whoami()
    if not info.authenticated:
        print(f"Not signed in to {bz.url}. Run: Bluz.login({bz.url!r})")
        return
    assert info.user is not None
    print(f"Signed in to {bz.url} as {info.user.name} <{info.user.email}>")
    if info.expires is not None:
        left = info.expires - datetime.now(UTC)
        print(
            f"Session expires {info.expires:%Y-%m-%d %H:%M} UTC ({left.days} days left)"
        )
    print(f"Config file: {bz.config!r}".replace(bz.config.token or "\0", "***"))


if __name__ == "__main__":
    with Bluz() as session:
        main(session)
