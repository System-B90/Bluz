"""
Name: help.py
Purpose: Plain-text overviews of sessions, API namespaces and models — what
         `bz.help()`, `bz.rooms.help()` and `bluz.describe(Curriculum)` print.
         Generated from the live objects, so they never drift from the code.
Created: 2026-10-02
Author: Michael K. Steinberg

The output is deliberately plain: no colour, no box drawing, one item per
line, indentation for structure. It reads the same in a terminal, a notebook,
a log file and a screen reader.
"""

from __future__ import annotations

import inspect
import re
import types
import typing
from collections.abc import Callable, Iterator
from typing import Any

__all__ = ["describe", "field_table", "type_name"]

_WIDTH = 100
# "`bz.rooms` — custom rooms." → "custom rooms." (the prefix is printed already)
_NAMESPACE_LEAD = re.compile(r"^`[^`]+`\s*[—-]\s*")
_QUALIFIED = re.compile(r"\b(?:[a-z_][\w]*\.)+(?=[A-Z_a-z])")


def type_name(annotation: Any) -> str:
    """A short, readable spelling of a type: `datetime | None`, `list[str]`."""
    if annotation is None or annotation is type(None):
        return "None"
    if isinstance(annotation, str):
        return _QUALIFIED.sub("", annotation)
    origin = typing.get_origin(annotation)
    if origin is typing.Annotated:
        return type_name(typing.get_args(annotation)[0])
    if origin in (typing.Union, types.UnionType):
        return " | ".join(type_name(arg) for arg in typing.get_args(annotation))
    if origin is not None:
        args = ", ".join(type_name(arg) for arg in typing.get_args(annotation))
        base = getattr(origin, "__name__", str(origin))
        return f"{base}[{args}]" if args else base
    if isinstance(annotation, type):
        return annotation.__name__
    return _QUALIFIED.sub("", str(annotation).replace("typing.", ""))


def _first_line(obj: Any) -> str:
    doc = inspect.getdoc(obj) or ""
    return doc.strip().splitlines()[0] if doc.strip() else ""


def _clip(text: str) -> str:
    return text if len(text) <= _WIDTH else text[: _WIDTH - 3] + "..."


def _signature(func: Callable[..., Any]) -> str:
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return "(...)"
    params = [
        param
        for name, param in signature.parameters.items()
        if name not in ("self", "cls")
    ]
    parts = []
    marked = False
    for param in params:
        if param.kind is param.KEYWORD_ONLY and not marked:
            parts.append("*")
            marked = True
        if param.kind is param.VAR_POSITIONAL:
            marked = True
        text = param.name
        if param.kind is param.VAR_POSITIONAL:
            text = "*" + text
        elif param.kind is param.VAR_KEYWORD:
            text = "**" + text
        if param.default is not param.empty:
            text += f"={param.default!r}"
        parts.append(text)
    returns = signature.return_annotation
    arrow = "" if returns is signature.empty else f" -> {type_name(returns)}"
    return f"({', '.join(parts)}){arrow}"


def _public_methods(obj: Any) -> Iterator[tuple[str, Callable[..., Any]]]:
    for name in sorted(dir(obj)):
        if name.startswith("_") and name not in ("__getitem__", "__iter__"):
            continue
        # Static lookup: a property (e.g. `course.children`) may need the
        # server, and describing an object must never make a request.
        raw = inspect.getattr_static(obj, name, None)
        if isinstance(raw, property) or not callable(raw) or isinstance(raw, type):
            continue
        yield name, getattr(obj, name)


def _method_lines(obj: Any, prefix: str) -> list[str]:
    lines = []
    for name, method in _public_methods(obj):
        if name == "help":
            continue
        shown = {"__getitem__": "[key]", "__iter__": " (iterable)"}.get(name)
        head = f"{prefix}{shown}" if shown else f"{prefix}.{name}{_signature(method)}"
        lines.append(_clip(f"    {head}"))
        summary = _first_line(method)
        if summary:
            lines.append(_clip(f"        {summary}"))
    return lines


def field_table(model: type[Any]) -> str:
    """One line per field: `name: type   (wire: camelName)`."""
    fields = getattr(model, "model_fields", {})
    if not fields:
        return ""
    width = max(len(name) for name in fields)
    lines = []
    for name, info in fields.items():
        if "[_" in type_name(info.annotation):
            # Raw junction rows (c2s, m2e, ...) — reached through properties.
            continue
        wire = info.alias or name
        note = f"   (wire: {wire})" if wire != name else ""
        lines.append(f"    {name:<{width}}  {type_name(info.annotation)}{note}")
    return "\n".join(lines)


def describe(obj: Any) -> str:
    """A plain-text overview of a session, an API namespace, or a model.

    Example:
        >>> print(bluz.describe(bz))            # every namespace and method
        >>> print(bluz.describe(bz.gantt.curriculums))
        >>> print(bluz.describe(Curriculum))    # fields + methods
    """
    from bluz.api._base import Resource
    from bluz.api.gantt import GanttAPI
    from bluz.models._base import BluzModel
    from bluz.sdk import Bluz

    if isinstance(obj, Bluz):
        lines = [f"{obj!r}", "", _first_line(Bluz), ""]
        for name, value in vars(obj).items():
            if isinstance(value, GanttAPI):
                for sub, api in vars(value).items():
                    lines += _namespace(api, f"bz.gantt.{sub}")
            elif isinstance(value, Resource):
                lines += _namespace(value, f"bz.{name}")
        lines += ["Session methods:"]
        lines += _method_lines(obj, "bz")
        return "\n".join(lines)
    if isinstance(obj, Resource):
        return "\n".join(_namespace(obj, _prefix(obj)))
    model = obj if isinstance(obj, type) else type(obj)
    if issubclass(model, BluzModel):
        lines = [model.__name__, _first_line(model), "", "Fields:", field_table(model)]
        own = [
            (name, value)
            for name, value in _public_methods(model)
            if name not in dir(BluzModel) or name in ("to_wire",)
        ]
        props = [
            name
            for name, value in inspect.getmembers(model)
            if isinstance(value, property)
            and not name.startswith(("_", "model_"))
            and name != "bluz"
        ]
        if props:
            lines += ["", "Properties:"]
            lines += [
                _clip(f"    .{name}  {_first_line(getattr(model, name))}")
                for name in props
            ]
        if own:
            lines += ["", "Methods:"]
            for name, method in own:
                lines.append(_clip(f"    .{name}{_signature(method)}"))
                summary = _first_line(method)
                if summary:
                    lines.append(_clip(f"        {summary}"))
        return "\n".join(lines)
    return inspect.getdoc(obj) or repr(obj)


def _namespace(api: Any, prefix: str) -> list[str]:
    summary = _NAMESPACE_LEAD.sub("", _first_line(api))
    return [f"{prefix} - {summary}", *_method_lines(api, prefix), ""]


def _prefix(api: Any) -> str:
    """How a script reaches this namespace: `bz.rooms`, `bz.gantt.modules`."""
    session = getattr(api, "_bluz", None)
    for name, value in vars(session or object()).items():
        if value is api:
            return f"bz.{name}"
        for sub, inner in vars(value).items() if hasattr(value, "__dict__") else ():
            if inner is api:
                return f"bz.{name}.{sub}"
    return type(api).__name__
