"""
Name: directory.py
Purpose: Rooms, courses, outsiders, custom colours and reservations. These
         share one shape on the server: a bulk collection path where PUT
         creates, POST updates and DELETE takes the id as a JSON body. None has
         a per-id GET, so `get()` filters the bulk list client-side.
         Mirrors ui/src/api-client/{rooms,courses,outsiders,custom-colors,
         reservations}.ts.
Created: 2026-10-02
Author: Michael K. Steinberg
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any

from bluz.api._base import Resource, find_by_id, iso, lookup, ref
from bluz.models._base import Collection, camel_payload
from bluz.models.directory import (
    Course,
    CustomColor,
    Outsider,
    Reservation,
    ReserverType,
    Room,
    RoomExtendedInfo,
    RoomSource,
)

if TYPE_CHECKING:
    from bluz.models.iterations import Iteration

__all__ = ["ColorsAPI", "CoursesAPI", "OutsidersAPI", "ReservationsAPI", "RoomsAPI"]

_ROOMS = "/api/rooms"
_COURSES = "/api/course"
_OUTSIDERS = "/api/outsiders"
_COLORS = "/api/custom-colors"
_RESERVATIONS = "/api/reservations"


class RoomsAPI(Resource):
    """`bz.rooms` — custom (Bluz) and Hive rooms.

    Example:
        >>> bz.rooms.list().where(source=RoomSource.CUSTOM)
        >>> bz.rooms["Lab 3"]                 # by id or name
        >>> bz.rooms.create("Lab 4", description="2nd floor")
    """

    def list(self) -> Collection[Room]:
        """Every room, custom and Hive."""
        return self._many(Room, self._http.get(_ROOMS))

    def get(self, room_id: int | str) -> Room:
        """One room by id (filtered client-side)."""
        return find_by_id(self.list(), room_id, what="room")

    def __getitem__(self, key: int | str) -> Room:
        """`bz.rooms["name or id"]`."""
        return lookup(self.list(), key, what="room")

    def create(
        self, name: str, *, description: str | None = None, room_id: str | None = None
    ) -> Room:
        """Create a custom room. An id is generated when omitted."""
        payload: dict[str, Any] = {
            "id": room_id or str(uuid.uuid4()),
            "name": name,
            "source": int(RoomSource.CUSTOM),
        }
        if description is not None:
            payload["description"] = description
        return self._one(Room, self._http.put(_ROOMS, json=payload))

    def update(
        self,
        room: Room | str,
        *,
        name: str | None = None,
        description: str | None = None,
    ) -> Room:
        """Update a custom room. Unset arguments are not sent."""
        payload = camel_payload(
            id=ref(room),
            name=name,
            description=description,
            source=int(RoomSource.CUSTOM),
        )
        return self._one(Room, self._http.post(_ROOMS, json=payload))

    def delete(self, room: Room | str) -> None:
        """Delete a custom room."""
        self._http.delete(_ROOMS, json=ref(room))

    def set_extended_info(
        self,
        room: Room | int | str,
        info: RoomExtendedInfo | dict[str, Any],
        *,
        source: RoomSource | int | None = None,
    ) -> None:
        """Replace a room's extended info. `source` defaults to the room's own
        (Hive when only an id is given)."""
        if source is None:
            source = room.source if isinstance(room, Room) else RoomSource.HIVE
        extended = info.to_wire() if isinstance(info, RoomExtendedInfo) else info
        self._http.patch(
            _ROOMS,
            json={
                "roomId": ref(room),
                "roomSource": int(source),
                "extendedInfo": extended,
            },
        )


class CoursesAPI(Resource):
    """`bz.courses` — the course (מסלול / shuffle) tree of an iteration.

    Example:
        >>> roots = bz.courses.roots()
        >>> bz.courses["Apollo"].children
    """

    def _params(self, iteration: str | Iteration | None) -> dict[str, Any]:
        return {"it": self._it(iteration)}

    def list(self, *, iteration: str | Iteration | None = None) -> Collection[Course]:
        return self._many(
            Course, self._http.get(_COURSES, params=self._params(iteration))
        )

    def get(
        self, course_id: str, *, iteration: str | Iteration | None = None
    ) -> Course:
        return find_by_id(self.list(iteration=iteration), course_id, what="course")

    def __getitem__(self, key: str) -> Course:
        return lookup(self.list(), key, what="course")

    def roots(self, *, iteration: str | Iteration | None = None) -> Collection[Course]:
        """Courses without a parent — the top of the tree."""
        return self.list(iteration=iteration).where(parent_id=None)

    def create(
        self,
        name: str,
        *,
        color: str | None = None,
        parent: Course | str | None = None,
        instructor_ids: Sequence[int] | None = None,
        course_id: str | None = None,
        iteration: str | Iteration | None = None,
        **fields: Any,
    ) -> Course:
        """Create a course; `parent` nests it under another."""
        payload = camel_payload(
            id=course_id or str(uuid.uuid4()),
            name=name,
            color=color,
            parent_id=ref(parent) if parent is not None else None,
            instructor_ids=list(instructor_ids) if instructor_ids is not None else None,
            **fields,
        )
        return self._one(
            Course,
            self._http.put(_COURSES, json=payload, params=self._params(iteration)),
        )

    def update(
        self,
        course: Course | str,
        *,
        name: str | None = None,
        color: str | None = None,
        parent: Course | str | None = None,
        instructor_ids: Sequence[int] | None = None,
        iteration: str | Iteration | None = None,
        **fields: Any,
    ) -> Course:
        payload = camel_payload(
            id=ref(course),
            name=name,
            color=color,
            parent_id=ref(parent) if parent is not None else None,
            instructor_ids=list(instructor_ids) if instructor_ids is not None else None,
            **fields,
        )
        return self._one(
            Course,
            self._http.post(_COURSES, json=payload, params=self._params(iteration)),
        )

    def delete(
        self, course: Course | str, *, iteration: str | Iteration | None = None
    ) -> None:
        self._http.delete(_COURSES, json=ref(course), params=self._params(iteration))


class OutsidersAPI(Resource):
    """`bz.outsiders` — external visitors / guest lecturers."""

    def list(self) -> Collection[Outsider]:
        return self._many(Outsider, self._http.get(_OUTSIDERS))

    def get(self, outsider_id: str) -> Outsider:
        return find_by_id(self.list(), outsider_id, what="outsider")

    def __getitem__(self, key: str) -> Outsider:
        return lookup(self.list(), key, what="outsider")

    def create(
        self,
        name: str,
        phone: str,
        *,
        personal_number: str | None = None,
        id_number: str | None = None,
        release_date: str | None = None,
        comment: str | None = None,
        outsider_id: str | None = None,
    ) -> Outsider:
        payload = camel_payload(
            id=outsider_id or f"outsider-{uuid.uuid4()}",
            name=name,
            phone=phone,
            personal_number=personal_number,
            id_number=id_number,
            release_date=release_date,
            comment=comment,
        )
        return self._one(Outsider, self._http.put(_OUTSIDERS, json=payload))

    def update(
        self,
        outsider: Outsider | str,
        *,
        name: str | None = None,
        phone: str | None = None,
        personal_number: str | None = None,
        id_number: str | None = None,
        release_date: str | None = None,
        comment: str | None = None,
    ) -> Outsider:
        payload = camel_payload(
            id=ref(outsider),
            name=name,
            phone=phone,
            personal_number=personal_number,
            id_number=id_number,
            release_date=release_date,
            comment=comment,
        )
        return self._one(Outsider, self._http.post(_OUTSIDERS, json=payload))

    def delete(self, outsider: Outsider | str) -> None:
        self._http.delete(_OUTSIDERS, json=ref(outsider))


class ColorsAPI(Resource):
    """`bz.colors` — named custom event colours."""

    def list(self) -> Collection[CustomColor]:
        return self._many(CustomColor, self._http.get(_COLORS))

    def get(self, color_id: str) -> CustomColor:
        return find_by_id(self.list(), color_id, what="colour")

    def __getitem__(self, key: str) -> CustomColor:
        return lookup(self.list(), key, what="colour")

    def create(
        self, name: str, hex: str, *, color_id: str | None = None
    ) -> CustomColor:
        body = {"id": color_id or str(uuid.uuid4()), "name": name, "hex": hex}
        return self._one(CustomColor, self._http.put(_COLORS, json=body))

    def update(
        self,
        color: CustomColor | str,
        *,
        name: str | None = None,
        hex: str | None = None,
    ) -> CustomColor:
        """Update a colour. The server replaces the whole record, so unset
        fields are carried over from the current value."""
        current = self.get(ref(color))
        body = {
            "id": current.id,
            "name": name if name is not None else current.name,
            "hex": hex if hex is not None else current.hex,
        }
        return self._one(CustomColor, self._http.post(_COLORS, json=body))

    def delete(self, color: CustomColor | str) -> None:
        self._http.delete(_COLORS, json=ref(color))


class ReservationsAPI(Resource):
    """`bz.reservations` — room bookings.

    Example:
        >>> bz.reservations.create(bz.rooms["Lab 3"], "2026-11-02T08:00",
        ...     "2026-11-02T10:00", reserver_type="outsider", reserver_id="outsider-1")
    """

    def list(
        self,
        *,
        room: Room | int | str | None = None,
        room_source: RoomSource | int | None = None,
        start: datetime | str | None = None,
        end: datetime | str | None = None,
        iteration: str | Iteration | None = None,
    ) -> Collection[Reservation]:
        """Reservations, optionally for one room and/or within a date range."""
        if room_source is None and isinstance(room, Room):
            room_source = room.source
        params = {
            "roomId": ref(room) if room is not None else None,
            "roomSource": int(room_source) if room_source is not None else None,
            "from": iso(start),
            "to": iso(end),
            "it": self._it(iteration),
        }
        return self._many(Reservation, self._http.get(_RESERVATIONS, params=params))

    def get(self, reservation_id: str) -> Reservation:
        for item in self.list():
            if item.mongo_id == reservation_id:
                return item
        from bluz.errors import NotFoundError

        raise NotFoundError(f"No reservation with _id={reservation_id!r} found.")

    def create(
        self,
        room: Room | int | str,
        start: datetime | str,
        end: datetime | str,
        *,
        reserver_type: ReserverType | str,
        reserver_id: str,
        room_source: RoomSource | int | None = None,
        note: str | None = None,
        iteration: str | Iteration | None = None,
    ) -> Reservation:
        if room_source is None:
            room_source = room.source if isinstance(room, Room) else RoomSource.HIVE
        payload: dict[str, Any] = {
            "roomId": ref(room),
            "roomSource": int(room_source),
            "start": iso(start),
            "end": iso(end),
            "reserverType": str(reserver_type),
            "reserverId": reserver_id,
        }
        if note is not None:
            payload["note"] = note
        return self._one(
            Reservation,
            self._http.put(
                _RESERVATIONS, json=payload, params={"it": self._it(iteration)}
            ),
        )

    def cancel(
        self,
        reservation: Reservation | str,
        *,
        iteration: str | Iteration | None = None,
    ) -> None:
        reservation_id = (
            reservation.mongo_id
            if isinstance(reservation, Reservation)
            else reservation
        )
        self._http.delete(
            _RESERVATIONS, json=reservation_id, params={"it": self._it(iteration)}
        )
