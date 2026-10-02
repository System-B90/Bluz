# Python SDK

`bluz` is the Python package for scripting a Bluz server. The same package
installs the [`bluz` CLI](../cli/index.md); the CLI is built on this SDK, so
everything a command does, a script can do too.

## Quick Start

```bash
pip install "bluz[ipython,excel]" --index-url https://system-b90.github.io/.github/pypi/
bluz login                      # browser sign-in, saved for the SDK and the CLI
ipython
```

```python
from datetime import timedelta
from bluz import Bluz, EventType, today

bz = Bluz()                                    # reuses `bluz login`
bz.require_login()                             # fail fast if the token expired

cur = bz.gantt.curriculums["Bis90 2026"]       # by title or id — the whole tree, one request
for syllabus in cur:                           # Curriculum → Syllabus → Module → GanttEvent
    for module in syllabus:
        for event in module:
            print(syllabus.title, module.title, event.title, event.allocated_duration)

week = bz.events.list(today(), today() + timedelta(days=7))
lectures = week.where(type=EventType.LECTURE)
```

## Discovering the API

| You type                           | You get                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `bz.` + Tab                        | every API namespace (`rooms`, `events`, `gantt`, …)        |
| `bz.help()`                        | every namespace and method, one line each, plain text      |
| `bz.rooms.help()`                  | one namespace's methods with signatures                    |
| `Curriculum.help()`                | a model's fields (with wire names), properties and methods |
| `help(Curriculum)` / `Curriculum?` | the docstring, which starts with a generated field table   |
| `curriculum.tree()`                | the curriculum as a tree (`rich.print(...)` in a terminal) |
| `python -m bluz.examples`          | runnable example scripts                                   |

Help output is plain text with no colour codes, one item per line, so it
reads the same in a terminal, a notebook, a log file or a screen reader.

## Signing in

Credentials resolve in this order: arguments → `BLUZ_URL` / `BLUZ_TOKEN` /
`BLUZ_INSECURE` (a local `.env` counts) → the file `bluz login` writes.

```python
bz = Bluz()                                    # saved login
bz = Bluz("https://bluz.example", token)       # explicit
bz = Bluz.login("https://bluz.example")        # browser sign-in, saved for next time

bz.whoami()          # SessionInfo(user=SessionUser(name=..., email=...), expires=...)
bz.is_authenticated  # True / False, never raises
bz.require_login()   # raises NotAuthenticatedError explaining what to do
```

Use `with Bluz() as bz:` to close the connection when a script ends.

## Conventions

- **snake_case attributes, camelCase wire.** `event.start_time` is
  `startTime` on the server. Both spellings construct a model. Fields this
  version does not know are kept, so `to_wire()` and updates are lossless.
- **Typed dates.** Timezone-aware `datetime` for instants, `date` for calendar
  days, `time` for `"HH:mm"` settings. Methods accept `date`, `datetime` or ISO
  strings. `bluz.today()` is today on the Bluz wall clock (Asia/Jerusalem).
- **Ids or objects.** Any argument naming a thing takes its id or the object.
- **Lookups.** `api["title or id"]` and `node["child"]` raise `NotFoundError`;
  `collection.find(...)` returns `None`; `collection.where(field=value)` filters.
- **Iterations.** Calls default to the current iteration; `bz.scoped("2026a")`
  gives a session that reads another one.
- **Errors.** Everything derives from `bluz.BluzError`. Server errors are
  `BluzApiError` with `.error_name`, `.error_message` and `.http_status`.
- **Drift.** A response that does not fit its model is kept unvalidated with a
  `ResponseShapeWarning`. Make it fatal in tests:
  `warnings.simplefilter("error", bluz.errors.ResponseShapeWarning)`.

## Reference

- [Session](session.md) — `Bluz`, signing in, help.
- [API namespaces](namespaces.md) — every `bz.<namespace>` method.
- [Models](models.md) — every object the API returns.
- [Examples](examples.md) — runnable scripts, including Excel import/export.
- [Errors](errors.md)
