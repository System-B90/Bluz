# `command-palette/`

A VSCode-style command palette. **Self-contained**: every file in this directory
imports only from `react`, `@mui/*`, and other files in this directory. That is
the whole point — the folder is meant to be lifted into a shared package and
reused by `peek-a-boo` and `madash`.

## Quick Start

```tsx
// 1. Mount the provider once, above every component that contributes commands.
import { CommandPaletteProvider } from "@/components/command-palette";

<CommandPaletteProvider labels={LABELS} storageNamespace="bluz">
    {children}
</CommandPaletteProvider>;
```

```tsx
// 2. Contribute commands from wherever the action can actually be performed.
import { useCommands } from "@/components/command-palette";

const commands = useMemo(
    () => [
        {
            id: "schedule.event.new",
            title: "אירוע חדש",
            keywords: ["new event", "create"],
            group: "לוח זמנים",
            kind: "command" as const,
            icon: <AddIcon />,
            run: () => setOpenEventDialog(true),
        },
    ],
    [setOpenEventDialog],
);

// Must be referentially stable — a fresh array every render re-registers every
// render. Pass a `(query) => Command[]` callback instead when the set is too
// large to materialise eagerly.
useCommands(commands);
```

```tsx
// 3. Open it from a button, if you want a mouse affordance too.
const { open } = useCommandPalette();
```

## Interaction model

| Input | Effect |
| --- | --- |
| `Ctrl`/`⌘` + `K` | Open with every lane in play |
| `Ctrl`/`⌘` + `Shift` + `P` | Open pre-filtered to the command lane |
| `>` prefix | Commands only |
| `@` prefix | Entities only |
| `:` prefix | Navigation only |
| `↑` `↓` `Home` `End` | Move selection (skips disabled rows) |
| `Enter` | Run the selected command |
| `Esc` | Close |

Lanes are a power-user shortcut, not a requirement: with no prefix the palette
searches everything at once.

## Layout

```
types.ts                   Public contracts. Start here.
core/                      No React. Portable, testable on its own.
  text.ts                  Hebrew-aware normalisation (niqqud, gershayim, final forms)
  fuzzy.ts                 Scoring + per-character match indices for highlighting
  modes.ts                 Prefix ⇄ lane parsing
  registry.ts              The contribution store
  recents.ts               localStorage MRU, folded into ranking
  rank.ts                  Filter → score → sort → group
CommandPaletteContext.ts   React context + the guard hook
CommandPaletteProvider.tsx Owns registry/recents/open state; renders the palette
useCommands.ts             Contribute commands while mounted
useCommandPalette.ts       Imperative open/close/toggle
useOpenPaletteHotkeys.ts   Window-level open shortcuts
CommandPaletteDialog.tsx   The MUI sheet
CommandPaletteRow.tsx      One result row
HighlightedText.tsx        Match highlighting
```

## Should this file live here?

Yes, if **all** of these hold:

- It imports nothing outside this directory except `react` and `@mui/*`.
- It contains no user-facing copy. Every string the palette renders arrives
  through the `labels` prop, so the package stays locale-free.
- It contains no knowledge of Bluz domain concepts — no curriculums, no
  syllabuses, no settings tabs.

Otherwise it belongs in `components/app-commands/`, which is where Bluz's own
command contributions live.

## Notes

- **Ranking** is text score (title > keywords > subtitle > group) plus a bounded
  recency bonus and a static `priority` nudge. Recency breaks ties; it never
  outranks a materially better text match.
- **RTL** is handled with logical properties throughout, and the query field
  uses `dir="auto"` so an ASCII lane prefix stays left-anchored while Hebrew
  text still lays out right-to-left.
- **The matcher is intentionally duplicated** from
  `components/gantt/curriculum-view/search/fuzzy.ts`. That file is Bluz's
  in-page gantt search; sharing one implementation would couple this package to
  the app. If the gantt search ever wants this matcher, it can import
  `matchText` from here — the dependency direction that way round is fine.

## Extraction checklist

When this becomes its own package:

1. Move the directory verbatim; there are no import paths to rewrite.
2. Add `react` and `@mui/material` as peer dependencies.
3. Re-export `index.ts` as the package entry point.
