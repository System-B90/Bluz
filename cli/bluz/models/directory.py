"""
Name: directory.py
Purpose: Directory-style models — rooms, courses, outsiders, custom colours and
         room reservations. Mirrors ui/src/api-shared/types/{room,course,
         outsider,custom-color,reservation}.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

from datetime import datetime
from enum import IntEnum, StrEnum
from typing import Annotated, Any, ClassVar

from pydantic import Field

from bluz.models._base import ENUM_FIRST as _ENUM_FIRST
from bluz.models._base import BluzModel, Collection

__all__ = [
    "Course",
    "CustomColor",
    "Outsider",
    "Reservation",
    "ReserverType",
    "Room",
    "RoomExtendedInfo",
    "RoomRef",
    "RoomSource",
]


class RoomSource(IntEnum):
    """Where a room is defined. Custom rooms live in Bluz; Hive rooms are read-only."""

    CUSTOM = 0
    HIVE = 1


class RoomRef(BluzModel):
    """A pointer to a room — what an event's `rooms` list holds."""

    _repr_fields = ("id", "source")

    id: int | str
    source: Annotated[RoomSource | int, _ENUM_FIRST]


class RoomExtendedInfo(BluzModel):
    """Capacity / comfort facts Bluz keeps per room (Hive does not have them)."""

    _repr_fields = (
        "workstation_count",
        "lecture_seat_count",
        "lecture_comfortable",
        "pe_ayin",
    )

    workstation_count: int | None = None
    lecture_seat_count: int | None = None
    lecture_comfortable: bool = False
    pe_ayin: bool = False


class Room(BluzModel):
    """A room. `source` says whether it is a Bluz custom room or a Hive room.

    Example:
        >>> room = bz.rooms["Lab 3"]
        >>> room.reservations(start="2026-11-01", end="2026-11-08")
    """

    _repr_fields = ("id", "name", "source")

    id: int | str
    name: str = ""
    description: str | None = None
    source: Annotated[RoomSource | int, _ENUM_FIRST] = RoomSource.CUSTOM
    extended_info: RoomExtendedInfo | None = None

    @property
    def is_custom(self) -> bool:
        return self.source == RoomSource.CUSTOM

    @property
    def ref(self) -> RoomRef:
        """This room as an event-style `{id, source}` reference."""
        return RoomRef(id=self.id, source=self.source)

    def reservations(
        self, *, start: datetime | str | None = None, end: datetime | str | None = None
    ) -> Collection[Reservation]:
        """Reservations of this room, optionally within a date range."""
        return self.bluz.reservations.list(room=self, start=start, end=end)

    def update(self, **fields: Any) -> Room:
        """Update this custom room (name, description)."""
        return self.bluz.rooms.update(self, **fields)

    def set_extended_info(self, info: RoomExtendedInfo | dict[str, Any]) -> None:
        """Replace this room's extended info (seats, workstations, comfort flags)."""
        self.bluz.rooms.set_extended_info(self, info)

    def delete(self) -> None:
        """Delete this custom room."""
        self.bluz.rooms.delete(self)


class Course(BluzModel):
    """A course (מסלול). Courses form a tree; a leaf course is a shuffle.

    Example:
        >>> apollo = bz.courses["Apollo"]
        >>> [c.name for c in apollo.children]
    """

    _repr_fields = ("id", "name")

    id: str
    name: str = ""
    color: str | None = None
    parent_id: str | None = None
    instructor_ids: list[int] = Field(default_factory=list)
    description: str | None = None
    hive_class_id: int | None = None

    @property
    def parent(self) -> Course | None:
        """The parent course, or None for a root."""
        if not self.parent_id:
            return None
        return self.bluz.courses.get(self.parent_id)

    @property
    def children(self) -> Collection[Course]:
        """Direct sub-courses."""
        return self.bluz.courses.list().where(parent_id=self.id)

    def update(self, **fields: Any) -> Course:
        return self.bluz.courses.update(self, **fields)

    def delete(self) -> None:
        self.bluz.courses.delete(self)


class Outsider(BluzModel):
    """An external visitor / lecturer (איש חוץ)."""

    _repr_fields = ("id", "name", "phone")

    id: str
    name: str = ""
    phone: str = ""
    personal_number: str | None = None
    id_number: str | None = None
    release_date: datetime | None = None
    comment: str | None = None

    def update(self, **fields: Any) -> Outsider:
        return self.bluz.outsiders.update(self, **fields)

    def delete(self) -> None:
        self.bluz.outsiders.delete(self)


class CustomColor(BluzModel):
    """A named colour users can paint events with."""

    _repr_fields = ("id", "name", "hex")

    id: str
    name: str = ""
    hex: str = ""

    def update(self, **fields: Any) -> CustomColor:
        return self.bluz.colors.update(self, **fields)

    def delete(self) -> None:
        self.bluz.colors.delete(self)


class ReserverType(StrEnum):
    INSTRUCTOR = "instructor"
    OUTSIDER = "outsider"


class Reservation(BluzModel):
    """A room booking by an instructor or an outsider."""

    _repr_fields: ClassVar[tuple[str, ...]] = (
        "mongo_id",
        "room_id",
        "start",
        "end",
        "reserver_id",
    )

    mongo_id: str | None = Field(default=None, alias="_id")
    room_id: int | str
    room_source: Annotated[RoomSource | int, _ENUM_FIRST]
    start: datetime
    end: datetime
    reserver_type: Annotated[ReserverType | str, _ENUM_FIRST]
    reserver_id: str
    note: str | None = None

    @property
    def id(self) -> str | None:
        """The reservation id (the server calls it `_id`)."""
        return self.mongo_id

    @property
    def room(self) -> Room:
        return self.bluz.rooms.get(self.room_id)

    def cancel(self) -> None:
        """Cancel (delete) this reservation."""
        self.bluz.reservations.cancel(self)
