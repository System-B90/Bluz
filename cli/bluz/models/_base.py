"""
Name: _base.py
Purpose: Base classes every Bluz model builds on — camelCase wire aliases over
         snake_case attributes, lossless round-trips, and a back-reference to
         the `Bluz` session that fetched the object so it can act on itself
         (`room.delete()`, `syllabus.modules`, ...).
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import inspect
import warnings
from collections.abc import Iterator, Mapping
from datetime import UTC, date, datetime, time
from typing import (
    TYPE_CHECKING,
    Annotated,
    Any,
    ClassVar,
    Generic,
    Self,
    SupportsIndex,
    TypeVar,
    overload,
)
from zoneinfo import ZoneInfo

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    PrivateAttr,
    ValidationError,
)
from pydantic.alias_generators import to_camel

from bluz.errors import DetachedModelError, ResponseShapeWarning

if TYPE_CHECKING:
    from bluz.sdk import Bluz

__all__ = [
    "APP_TIMEZONE",
    "ENUM_FIRST",
    "HHMM",
    "BluzModel",
    "Collection",
    "EpochMs",
    "LenientDate",
    "camel_payload",
    "to_wire",
    "today",
]

# `Annotated[SomeEnum | str, ENUM_FIRST]`: parse into the enum when the value
# is a known member, keep the raw value when the server sends a newer one.
ENUM_FIRST = Field(union_mode="left_to_right")


APP_TIMEZONE = ZoneInfo("Asia/Jerusalem")
"""The wall clock the Bluz server schedules in (APP_TIMEZONE in api-shared)."""


def today() -> date:
    """Today's date on the Bluz wall clock (not the machine's)."""
    return datetime.now(APP_TIMEZONE).date()


def _date_part(value: Any) -> Any:
    # The server sends calendar dates both as "YYYY-MM-DD" and as midnight
    # ISO datetimes; the date is what matters either way.
    if isinstance(value, str) and len(value) > 10 and value[10] in "T ":
        return value[:10]
    if isinstance(value, datetime):
        return value.date()
    return value


def _from_epoch_ms(value: Any) -> Any:
    if isinstance(value, int | float):
        return datetime.fromtimestamp(value / 1000, tz=UTC)
    return value


def _to_epoch_ms(value: Any) -> int:
    # Rows built without validation keep the raw int; pass it through.
    if isinstance(value, int | float):
        return int(value)
    return int(value.timestamp() * 1000)


LenientDate = Annotated[date, BeforeValidator(_date_part)]
"""A calendar date, accepted as "YYYY-MM-DD" or an ISO datetime; sent as "YYYY-MM-DD"."""

HHMM = Annotated[
    time,
    PlainSerializer(
        lambda value: value.strftime("%H:%M"), return_type=str, when_used="json"
    ),
]
"""A wall-clock time the server stores as "HH:mm"."""

EpochMs = Annotated[
    datetime,
    BeforeValidator(_from_epoch_ms),
    PlainSerializer(_to_epoch_ms, return_type=int, when_used="json"),
]
"""A UTC datetime the server stores as epoch milliseconds."""


class BluzModel(BaseModel):
    """Base of every object the API returns.

    * Attributes are snake_case (`event.start_time`); the wire is camelCase
      (`startTime`). Both spellings are accepted when constructing.
    * Fields the server sends that this version of the package does not know
      are kept (`extra="allow"`), so `to_wire()` never drops data on an update.
    * Objects fetched through a `Bluz` session stay bound to it — that is what
      lets `course.parent`, `module.events` or `room.delete()` work.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
        arbitrary_types_allowed=True,
    )

    # Fields shown by repr()/IPython. Everything else stays one attribute away,
    # so a nested tree does not flood the console.
    _repr_fields: ClassVar[tuple[str, ...]] = ("id",)

    _bluz: Bluz | None = PrivateAttr(default=None)

    @classmethod
    def __pydantic_init_subclass__(cls, **kwargs: Any) -> None:
        """Append a generated "Fields" table to every model's docstring, so
        `help(Model)` and IPython's `Model?` list the attributes up front
        instead of burying them under pydantic's inherited methods."""
        super().__pydantic_init_subclass__(**kwargs)
        from bluz.help import field_table

        table = field_table(cls)
        if table and "\nFields:\n" not in (cls.__doc__ or ""):
            cls.__doc__ = f"{inspect.cleandoc(cls.__doc__ or '')}\n\nFields:\n{table}\n"

    @classmethod
    def help(cls) -> None:
        """Print this model's fields, properties and methods, one per line."""
        from bluz.help import describe

        print(describe(cls))

    # --- binding --------------------------------------------------------------

    @classmethod
    def from_wire(cls, data: Mapping[str, Any], bluz: Bluz | None = None) -> Self:
        """Parse a wire (camelCase JSON) object and bind it to `bluz`.

        A response that does not fit the model (an older/newer server, a
        write route that answers `{ok: true}`) must not turn a successful call
        into an exception, so it falls back to an unvalidated model and emits
        a `ResponseShapeWarning` instead.
        """
        try:
            return cls.model_validate(data)._bind(bluz)
        except ValidationError as exc:
            warnings.warn(
                f"{cls.__name__} response did not match the model: "
                f"{exc.error_count()} issue(s); kept unvalidated.",
                ResponseShapeWarning,
                stacklevel=3,
            )
            fields = dict(data) if isinstance(data, Mapping) else {}
            return cls.model_construct(**fields)._bind(bluz)

    def _bind(self, bluz: Bluz | None) -> Self:
        self._bluz = bluz
        for value in self.__dict__.values():
            _bind_nested(value, bluz)
        return self

    @property
    def bluz(self) -> Bluz:
        """The session this object was fetched with."""
        if self._bluz is None:
            raise DetachedModelError(type(self).__name__)
        return self._bluz

    # --- serialisation --------------------------------------------------------

    def to_wire(self) -> dict[str, Any]:
        """The camelCase JSON object the server speaks (only fields that were set)."""
        return self.model_dump(
            by_alias=True, mode="json", exclude_unset=True, warnings=False
        )

    # --- display --------------------------------------------------------------

    def _repr_items(self) -> list[tuple[str, Any]]:
        return [
            (name, getattr(self, name, None))
            for name in self._repr_fields
            if getattr(self, name, None) not in (None, "", [])
        ]

    def __repr__(self) -> str:
        body = ", ".join(f"{name}={value!r}" for name, value in self._repr_items())
        return f"{type(self).__name__}({body})"

    def __str__(self) -> str:
        return repr(self)

    def _repr_pretty_(self, printer: Any, cycle: bool) -> None:
        """IPython display hook: the short repr, not pydantic's full field dump."""
        printer.text(repr(self))


def _bind_nested(value: Any, bluz: Bluz | None) -> None:
    if isinstance(value, BluzModel):
        value._bind(bluz)
    elif isinstance(value, list):
        for item in value:
            _bind_nested(item, bluz)
    elif isinstance(value, dict):
        for item in value.values():
            _bind_nested(item, bluz)


def to_wire(value: Any) -> Any:
    """Recursively turn models (and lists/dicts of them) into wire JSON."""
    if isinstance(value, BluzModel):
        return value.to_wire()
    if isinstance(value, list):
        return [to_wire(item) for item in value]
    if isinstance(value, dict):
        return {key: to_wire(item) for key, item in value.items()}
    return value


def camel_payload(
    data: Mapping[str, Any] | BluzModel | None = None, **fields: Any
) -> dict[str, Any]:
    """Merge a wire mapping with snake_case keyword fields, dropping None.

    `camel_payload({"title": "x"}, is_draft=True)` → `{"title": "x", "isDraft": True}`.
    Lets every write method take either a raw JSON payload, a model, or
    Pythonic keyword arguments — or a mix.
    """
    if isinstance(data, BluzModel):
        payload = data.to_wire()
    else:
        payload = dict(data or {})
    for key, value in fields.items():
        if value is None:
            continue
        payload[to_camel(key)] = to_wire(value)
    return payload


T = TypeVar("T", bound=BluzModel)


class Collection(list[T], Generic[T]):
    """A list of models with lookup helpers.

    Behaves exactly like `list`, plus:

    * `coll["Title"]` / `coll["id"]` — find by title, name or id.
    * `coll.find("Title")` — same, but returns None on a miss.
    * `coll.where(is_draft=True)` — filter by attribute values.
    * `coll.ids` — every item's id.
    """

    _match_attrs: ClassVar[tuple[str, ...]] = ("id", "title", "name", "label")

    @overload
    def __getitem__(self, key: SupportsIndex, /) -> T: ...
    @overload
    def __getitem__(self, key: slice[Any, Any, Any], /) -> list[T]: ...
    @overload
    def __getitem__(self, key: str, /) -> T: ...
    def __getitem__(self, key: Any, /) -> Any:
        if isinstance(key, str):
            found = self.find(key)
            if found is None:
                raise KeyError(key)
            return found
        return super().__getitem__(key)

    def find(self, key: str) -> T | None:
        """The first item whose id, title, name or label equals `key`."""
        for item in self:
            for attr in self._match_attrs:
                if str(getattr(item, attr, None)) == key:
                    return item
        return None

    def where(self, **criteria: Any) -> Collection[T]:
        """Items whose attributes equal every given value."""
        return Collection(
            item
            for item in self
            if all(getattr(item, key, None) == value for key, value in criteria.items())
        )

    @property
    def ids(self) -> list[Any]:
        """Every item's id, in order."""
        return [getattr(item, "id", None) for item in self]

    def to_wire(self) -> list[Any]:
        """The items as wire JSON."""
        return [to_wire(item) for item in self]

    def __iter__(self) -> Iterator[T]:
        return super().__iter__()

    def __repr__(self) -> str:
        if len(self) <= 6:
            return f"Collection({list.__repr__(self)})"
        head = ", ".join(repr(item) for item in self[:5])
        return f"Collection([{head}, … {len(self) - 5} more])"

    def _repr_pretty_(self, printer: Any, cycle: bool) -> None:
        with printer.group(1, "[", "]"):
            for index, item in enumerate(self):
                if index:
                    printer.text(",")
                    printer.breakable()
                printer.text(repr(item))
