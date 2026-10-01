"""
Name: _base.py
Purpose: Shared plumbing for resource APIs — the session back-reference,
         id-or-object argument resolution, iteration scoping and date
         formatting.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any, TypeVar

from bluz.errors import NotFoundError
from bluz.models._base import BluzModel, Collection

if TYPE_CHECKING:
    from bluz.client import BluzClient
    from bluz.models.iterations import Iteration
    from bluz.sdk import Bluz

M = TypeVar("M", bound=BluzModel)


class Resource:
    """Base of every `bz.<resource>` namespace."""

    def __init__(self, bluz: Bluz) -> None:
        self._bluz = bluz

    @property
    def _http(self) -> BluzClient:
        return self._bluz.http

    def _it(self, iteration: str | Iteration | None) -> str | None:
        """Resolve an iteration argument, falling back to the session default."""
        if iteration is None:
            return self._bluz.iteration
        return ref(iteration)

    def _one(self, model: type[M], data: Any) -> M:
        return model.from_wire(data, self._bluz)

    def _many(self, model: type[M], data: Any) -> Collection[M]:
        return Collection(model.from_wire(item, self._bluz) for item in data or [])

    def __repr__(self) -> str:
        public = sorted(
            name
            for name in dir(self)
            if not name.startswith("_") and callable(getattr(self, name, None))
        )
        return f"<{type(self).__name__}: {', '.join(public)}>"


def ref(value: Any, *, attr: str = "id") -> Any:
    """An id from either an id or a model carrying one."""
    if isinstance(value, BluzModel):
        return getattr(value, attr)
    return value


def refs(values: list[Any] | tuple[Any, ...]) -> list[Any]:
    return [ref(value) for value in values]


def iso(value: datetime | date | str | None) -> str | None:
    """Format a date/datetime query value; strings pass through untouched."""
    if value is None or isinstance(value, str):
        return value
    return value.isoformat()


def find_by_id(items: Collection[M], item_id: Any, *, what: str) -> M:
    """Client-side pick from a bulk list (several resources have no per-id route)."""
    for item in items:
        if str(getattr(item, "id", None)) == str(item_id):
            return item
    raise NotFoundError(f"No {what} with id={item_id!r} found.")


def lookup(items: Collection[M], key: Any, *, what: str) -> M:
    """Find by id, falling back to title/name/label."""
    found = items.find(str(ref(key)))
    if found is None:
        raise NotFoundError(f"No {what} matching {key!r}.")
    return found
