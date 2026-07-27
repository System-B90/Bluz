# `app-commands/`

Bluz's contributions to the command palette. This is the **Bluz-specific half**
of the feature — the generic, extractable half lives in
[`../command-palette/`](../command-palette/README.md) and knows nothing about
curriculums, syllabuses or settings tabs.

## Quick Start

```tsx
// Mounted once, in the post-auth layout — wraps the app in the palette.
<BluzCommandPalette>{children}</BluzCommandPalette>
```

```tsx
// Contribute page-local commands from the component that owns the state.
useScheduleCommands({ createEvent, undo, redo });
```

## Where each command comes from

Commands are registered by whichever component can actually perform them, so
the palette's contents follow the user around the app.

| File | Registered by | Lane | Contributes |
| --- | --- | --- | --- |
| `useNavigationCommands.tsx` | app-wide (`AppCommands`) | `goto` | Schedule ⇄ Gantt |
| `useSettingsCommands.tsx` | app-wide | `command` | One deep link per settings tab |
| `useAppearanceCommands.tsx` | app-wide | `command` | Theme toggle / dark / light / system |
| `useDirectoryCommands.tsx` | app-wide | `entity` | Rooms and outsiders, opened for editing |
| `useScheduleCommands.tsx` | `(schedule)/page.tsx` | `command` | New event, undo/redo, offline toggle |
| `useCurriculumCommands.tsx` | `gantt/curriculum-fab` | `entity` | Switch curriculum |
| `GanttContentCommands.tsx` | `gantt/curriculum-view` | `entity` | Syllabuses, modules, events in the loaded curriculum |

App-wide commands read from the Hive/settings data providers, so
`BluzCommandPalette` must be mounted **inside** them — currently in
`app/(themed)/(post-auth)/(with-hive)/layout.tsx`.

## Should this file live here?

Yes, if it names a Bluz concept — a route, a settings tab, a curriculum, a room
— or contains Hebrew copy.

No, if it is generic palette machinery (matching, ranking, the dialog, the
registry). That belongs in `../command-palette/`, which must stay free of any
import from outside itself.

## Adding a command

1. Pick the component that owns the state the command acts on.
2. Build the array with `useMemo` and pass it to `useCommands` — it must be
   referentially stable.
3. Give it a stable `id` (`<surface>.<thing>.<verb>`), a `group` from
   `COMMAND_GROUPS`, and English `keywords` alongside the Hebrew `title` so it
   is reachable in either language.
