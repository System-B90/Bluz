# `app-commands/`

Bluz's contributions to the command palette. This is the **Bluz-specific half**
of the feature — the generic half now ships as
[`@system-b90/command-palette`](https://github.com/System-B90/command-palette)
and knows nothing about curriculums, syllabuses or settings tabs.

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
| `use-schedule-event-commands.tsx` | `schedule/calendar/calendar` | `entity` | Events in the loaded week |
| `use-gantt-tab-commands.tsx` | `gantt/curriculum-view` | `command` | Switch gantt tab (syllabuses / weeks / timeline) |
| `useCurriculumCommands.tsx` | `gantt/curriculum-fab` | `entity` | Switch curriculum |
| `GanttContentCommands.tsx` | `gantt/curriculum-view` | `entity` | Syllabuses, modules, events in the loaded curriculum |

Beyond those files, most on-screen buttons mirror themselves from their own
component with `useCommand` (see "Mirroring a button" below), so their commands
live next to the button, not here.

App-wide commands read from the Hive/settings data providers, so
`BluzCommandPalette` must be mounted **inside** them — currently in
`app/(themed)/(post-auth)/(with-hive)/layout.tsx`.

## Should this file live here?

Yes, if it names a Bluz concept — a route, a settings tab, a curriculum, a room
— or contains Hebrew copy.

No, if it is generic palette machinery (matching, ranking, the dialog, the
registry). That belongs in the `@system-b90/command-palette` package, which must
stay free of any knowledge of a host app. Send a PR there rather than
re-growing a local copy here.

## Adding a command

1. Pick the component that owns the state the command acts on.
2. Build the array with `useMemo` and pass it to `useCommands` — it must be
   referentially stable.
3. Give it a stable `id` (`<surface>.<thing>.<verb>`), a `group` from
   `COMMAND_GROUPS`, and English `keywords` alongside the Hebrew `title` so it
   is reachable in either language.

## Mirroring a button

Buttons and their palette commands must call the **same handler** — never a
copy of its logic.

- One button: `useCommand({ id, title, group, icon, run: sameHandler })` in the
  component that owns the button. Memoised on its fields, so an inline object
  is fine. Pass `null` to register nothing.
- Popover/menu triggers: read the anchor from a `ref`, not the click event, so
  the command can open it too (`CalendarToolbar`, `GanttFilterButton`).
- Shared buttons carry it for you:
  - `ActionItemButton` — `command={{ id, keywords }}`; title, icon, enabled and
    `onClick` come from the button.
  - `ImportExportMenuButton` — `command={{ id, group }}` registers
    `<id>.export`, `<id>.export.excel` and `<id>.import`.
- Hidden containers (popovers, menus) must stay mounted (`keepMounted`) or the
  commands inside disappear while closed.

## Wording

`labels.ts` builds `PALETTE_LABELS` from the package's Hebrew table
(`@system-b90/command-palette/he`) with `withLabelOverrides` for the strings
Bluz says differently. Import `/he` only — pulling in `/en` as well would ship
both languages' strings to every user.
